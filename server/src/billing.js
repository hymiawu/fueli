// Subscription billing with Stripe Checkout (test mode in this deployment).
// Status lives in the Supabase `subscriptions` table: users can read their own row (RLS),
// but only this module writes it, using data fetched from Stripe or a signed Stripe webhook.
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

// The service-role key is used only here, and only to write subscription rows.
// Every other query still runs as the signed-in user.
const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

const PLAN = {
  currency: 'usd',
  unit_amount: 499,
  recurring: { interval: 'month' },
  product_data: { name: 'Fueli monthly' },
};

// 'grandfathered' marks accounts that existed before payments were required.
const ACTIVE = new Set(['active', 'trialing', 'grandfathered']);

const fail = (status, message) => Object.assign(new Error(message), { status });

function requireStripe() {
  if (!stripe || !admin) throw fail(503, 'Payments are not configured');
}

async function readStatus(req) {
  const { data, error } = await req.db
    .from('subscriptions')
    .select('status, stripe_customer_id, stripe_subscription_id')
    .eq('user_id', req.user.id)
    .maybeSingle();
  if (error) throw fail(502, 'Could not read subscription');
  return data;
}

async function save(userId, fields) {
  const { error } = await admin
    .from('subscriptions')
    .upsert({ user_id: userId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw fail(502, 'Could not save subscription');
}

const fromSubscription = (sub) => ({
  status: sub.status,
  stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
  stripe_subscription_id: sub.id,
});

export async function getStatus(req) {
  const row = await readStatus(req);
  const status = row?.status ?? 'none';
  return { active: ACTIVE.has(status), status, price: '$4.99/month' };
}

// Status plus live renewal details from Stripe, for the Membership screen.
export async function getMembership(req) {
  const row = await readStatus(req);
  const out = { ...(await getStatus(req)), cancelAtPeriodEnd: false, periodEnd: null };
  if (stripe && row?.stripe_subscription_id && out.status !== 'canceled') {
    const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
    out.cancelAtPeriodEnd = Boolean(sub.cancel_at_period_end || sub.cancel_at);
    // Newer Stripe API versions report the billing period on the subscription item.
    const end = sub.cancel_at ?? sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end;
    out.periodEnd = end ? new Date(end * 1000).toISOString() : null;
  }
  return out;
}

// Grandfathered accounts have no Stripe subscription: canceling ends their free access right away.
// Paid accounts cancel at the end of the period they paid for.
export async function cancelMembership(req) {
  const row = await readStatus(req);
  if (row?.status !== 'grandfathered') return setCancelAtPeriodEnd(req, true);
  if (!admin) throw fail(503, 'Payments are not configured');
  await save(req.user.id, { status: 'canceled' });
  return getMembership(req);
}

// Cancel at the end of the paid period (access continues until then), or undo that.
export async function setCancelAtPeriodEnd(req, cancel) {
  requireStripe();
  const row = await readStatus(req);
  if (!row?.stripe_subscription_id || !['active', 'trialing'].includes(row.status)) throw fail(409, 'No active subscription to change');
  const sub = await stripe.subscriptions.update(row.stripe_subscription_id, { cancel_at_period_end: cancel });
  await save(req.user.id, fromSubscription(sub));
  return getMembership(req);
}

// Express middleware: only paying (or grandfathered) accounts can use the AI endpoints.
export async function requirePaid(req, res, next) {
  try {
    if ((await getStatus(req)).active) return next();
    res.status(402).json({ error: 'A Fueli subscription is required' });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}

export async function createCheckout(req, appUrl) {
  requireStripe();
  const row = await readStatus(req);
  if (ACTIVE.has(row?.status)) throw fail(409, 'You already have an active subscription');

  let customer = row?.stripe_customer_id;
  if (!customer) {
    ({ id: customer } = await stripe.customers.create({ email: req.user.email, metadata: { user_id: req.user.id } }));
    await save(req.user.id, { status: 'incomplete', stripe_customer_id: customer });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: req.user.id,
    line_items: [{ price_data: PLAN, quantity: 1 }],
    subscription_data: { metadata: { user_id: req.user.id } },
    success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/?checkout=cancel`,
  });
  return { url: session.url };
}

// Called when the user returns from Checkout, so access starts without waiting for the webhook.
export async function confirmCheckout(req, sessionId) {
  requireStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
  if (session.client_reference_id !== req.user.id) throw fail(403, 'This checkout belongs to another account');
  if (session.status === 'complete' && session.subscription) await save(req.user.id, fromSubscription(session.subscription));
  return getStatus(req);
}

// Stripe webhook: keeps status in sync for renewals, failed payments and cancellations.
export async function handleWebhook(rawBody, signature) {
  requireStripe();
  if (!WEBHOOK_SECRET) throw fail(503, 'Webhook secret is not configured');
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);
  } catch {
    throw fail(400, 'Invalid signature');
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.mode === 'subscription' && session.client_reference_id && session.subscription) {
      await save(session.client_reference_id, fromSubscription(await stripe.subscriptions.retrieve(session.subscription)));
    }
  } else if (event.type.startsWith('customer.subscription.')) {
    const sub = event.data.object;
    if (sub.metadata?.user_id) await save(sub.metadata.user_id, fromSubscription(sub));
  }
}

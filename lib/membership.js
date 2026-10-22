// The subscription price shown in the app. Must match server/src/price.js, which sets what Stripe charges.
export const PRICE_LABEL = '$9.99';
export const PRICE_PER_MONTH = `${PRICE_LABEL}/month`;

// Human-readable labels for subscription statuses reported by the API.
export function membershipLabel(status) {
  switch (status) {
    case 'active': return `Active · ${PRICE_PER_MONTH}`;
    case 'trialing': return 'Free trial';
    case 'grandfathered': return 'Free early-member access';
    case 'past_due': return 'Payment past due';
    case 'unpaid': return 'Unpaid';
    default: return 'Not subscribed';
  }
}

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

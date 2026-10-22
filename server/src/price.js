// The one place the subscription price is set. billing.js sends it to Stripe Checkout as inline price_data,
// so changing it here changes what new subscribers pay; existing Stripe subscriptions keep their old price.
export const PRICE_CENTS = 999;
export const PRICE_LABEL = `$${(PRICE_CENTS / 100).toFixed(2)}`; // "$9.99"
export const PRICE_PER_MONTH = `${PRICE_LABEL}/month`;

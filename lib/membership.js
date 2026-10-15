// Human-readable labels for subscription statuses reported by the API.
export function membershipLabel(status) {
  switch (status) {
    case 'active': return 'Active · $4.99/month';
    case 'trialing': return 'Free trial';
    case 'grandfathered': return 'Free early-member access';
    case 'past_due': return 'Payment past due';
    case 'unpaid': return 'Unpaid';
    default: return 'Not subscribed';
  }
}

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';

// Decide where a signed-in user goes: the app if their subscription is active, otherwise the paywall.
import { Platform } from 'react-native';
import { getBillingStatus } from './api';

// Stripe Checkout returns to the site root with ?checkout=..., which the paywall screen handles.
export const checkoutReturn = () => {
  if (Platform.OS !== 'web') return null;
  const params = new URLSearchParams(window.location.search);
  const result = params.get('checkout');
  return result ? { result, sessionId: params.get('session_id') } : null;
};

export async function enterApp(navigation) {
  if (checkoutReturn()) return navigation.replace('Paywall');
  try {
    const { active } = await getBillingStatus();
    navigation.replace(active ? 'Home' : 'Paywall');
  } catch {
    navigation.replace('Paywall');
  }
}

// A 402 means the subscription ended while the app was open: send the user to the payment screen.
// Returns true when it handled the error. Tab screens reset the root stack, which is their parent.
export function handleSubscriptionLapse(e, navigation) {
  if (e?.status !== 402) return false;
  (navigation.getParent?.() ?? navigation).reset({ index: 0, routes: [{ name: 'Paywall' }] });
  return true;
}

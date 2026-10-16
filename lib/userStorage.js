// Device storage scoped to the signed-in account, so meal plans, workouts and caches
// never carry over to another account that signs in on the same device.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Keys from before storage was per account. Their owner is unknown, so they are deleted, not migrated.
const LEGACY_KEYS = ['mealPlans', 'workoutPlans', 'ingredients', 'mealServings'];
let legacyCleared = false;

async function userKey(name) {
  if (!legacyCleared) {
    legacyCleared = true;
    await AsyncStorage.multiRemove(LEGACY_KEYS).catch(() => {});
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in again.');
  return `${name}:${session.user.id}`;
}

export const getUserItem = async (name) => AsyncStorage.getItem(await userKey(name));
export const setUserItem = async (name, value) => AsyncStorage.setItem(await userKey(name), value);

// The signed-in user from the session saved on this device. Unlike supabase.auth.getUser(), this makes no call
// to Supabase's auth service (which was taking 16-80 s at times on Oct 22); the database still checks every
// request against the session's token, so this is only for knowing who is signed in and their profile.
import { supabase } from './supabase';

export async function currentUser() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Publishable values (safe in the client; access is enforced by Row Level Security).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://rdtqyizwcmhxirbganhn.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_SSbbRQBQJwGeKhKYZO-l7g_KisEr8P-';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

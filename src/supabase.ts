// Spartans — Supabase client.
// Keys come from .env (EXPO_PUBLIC_* vars are inlined by Expo at build time).
// The anon/publishable key is safe to ship: every table is behind row-level
// security (supabase/migrations/0001_init.sql). Never put the service key here.
//
// Sessions persist in AsyncStorage. Upgrade to expo-secure-store once we do a
// dev build (Expo Go can't use it for values > 2 KB anyway).

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// True when .env is filled in. Screens fall back to local-only behaviour
// otherwise, so the app still runs with no backend (offline contract).
export const backendConfigured = Boolean(url && key);

export const supabase = createClient(url || 'http://localhost', key || 'anon', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
if (backendConfigured) {
  AppState.addEventListener('change', state => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

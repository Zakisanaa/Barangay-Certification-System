import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: { eventsPerSecond: 5 },
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Database is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the app environment.");
  }
  return supabase;
}

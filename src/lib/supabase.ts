import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser-only client. The session lives in localStorage so the app keeps
// working when it is opened offline from the Home Screen. Row Level Security
// in the database decides what each person may read or change.
let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    }
    client = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        experimental: { passkey: true },
      },
    });
  }
  return client;
}

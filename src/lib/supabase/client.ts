import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * A throwaway client that never writes a session to cookies/storage. Used
 * by the sign-in flow to check the password (step 2) without signing the
 * user in yet: the real session is only created once the emailed code is
 * verified (step 3), so the code step can't be skipped by navigating away.
 */
export function createEphemeralClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "komunitas-password-check",
      },
    }
  );
}

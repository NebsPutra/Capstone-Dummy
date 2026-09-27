import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for server routes only (PIN sign-in, PIN recovery).
 * It bypasses RLS, so it is never imported by client code (`server-only`
 * makes that a build error) and SUPABASE_SERVICE_ROLE_KEY has no
 * NEXT_PUBLIC_ prefix. Returns null when the key isn't configured.
 */
export function createAdminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!key || !url) return null;
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/** A session-less anon client (sends email codes without touching cookies). */
export function createAnonClient(): SupabaseClient {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

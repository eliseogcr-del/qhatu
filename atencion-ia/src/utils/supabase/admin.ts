import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Client with the service_role key: bypasses RLS entirely. Only used for
// admin operations the publishable key can't do (creating Auth users during
// tenant registration), and only from server actions — never imported in a
// client component.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

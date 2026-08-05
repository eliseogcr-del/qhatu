import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Cliente con la service_role key: se salta RLS por completo. Solo se usa
// para operaciones de administración que la key publicable no puede hacer
// (crear/editar usuarios de Auth), y solo desde server actions ya protegidas
// por requireAdmin() — nunca se importa en un componente cliente.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

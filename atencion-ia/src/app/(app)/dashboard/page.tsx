import { createClient } from "@/utils/supabase/server";
import { getTenantSession } from "@/utils/supabase/session";

export default async function DashboardPage() {
  const supabase = await createClient();
  const session = await getTenantSession(supabase);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900">
        Hola, {session.nombre ?? "de nuevo"}
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Tu cuenta y tu empresa ya están conectadas a Supabase. La bandeja de
        conversaciones, WhatsApp/Instagram e IA se construyen en los
        siguientes pasos del plan.
      </p>
    </div>
  );
}

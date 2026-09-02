import { createClient } from "@/utils/supabase/server";
import { getTenantSession } from "@/utils/supabase/session";
import { signOut } from "@/app/login/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const session = await getTenantSession(supabase);

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nombre")
    .eq("id", session.tenantId)
    .single();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div>
          <p className="font-semibold text-gray-900">Atención IA</p>
          <p className="text-xs text-gray-500">{tenant?.nombre}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Cerrar sesión
          </button>
        </form>
      </header>
      <main className="flex-1 bg-gray-50 p-6">{children}</main>
    </div>
  );
}

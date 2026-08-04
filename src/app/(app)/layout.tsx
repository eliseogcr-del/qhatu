import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "../login/actions";
import Logo from "@/components/Logo";
import SidebarNav from "@/components/SidebarNav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = usuario?.rol === "admin";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-64 shrink-0 flex-col border-r border-emerald-900/10 bg-emerald-50">
        <div className="flex items-center gap-2 border-b border-emerald-900/10 px-5 py-5">
          <Logo className="h-9 w-9" />
          <span className="text-xl font-semibold tracking-tight text-emerald-950">
            Qhatu
          </span>
        </div>

        <SidebarNav isAdmin={isAdmin} />

        <div className="border-t border-emerald-900/10 p-4">
          <p className="mb-2 truncate px-1 text-xs text-emerald-900/60">
            {user.email}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl border border-emerald-900/15 bg-white px-3 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-100"
            >
              <LogOut size={16} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

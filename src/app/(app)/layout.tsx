import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { signOut } from "../login/actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Panel" },
  { href: "/clientes", label: "Clientes" },
  { href: "/productos", label: "Productos" },
  { href: "/proveedores", label: "Proveedores" },
  { href: "/pedidos", label: "Pedidos" },
  { href: "/repartos", label: "Reparto" },
  { href: "/ventas", label: "Ventas" },
  { href: "/cobranzas", label: "Cobranzas" },
  { href: "/inventario", label: "Inventario" },
  { href: "/kardex", label: "Kardex" },
  { href: "/reportes", label: "Reportes" },
];

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-3 px-8 py-4">
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-lg font-semibold text-gray-900">Qhatu</span>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

import Link from "next/link";
import {
  Users,
  Package,
  Truck,
  ClipboardList,
  Route,
  ShoppingCart,
  Wallet,
  Boxes,
  BarChart3,
  ArrowLeftRight,
  PackagePlus,
  ScrollText,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";

const QUICK_LINKS_COMPLETO = [
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/proveedores", label: "Proveedores", icon: Truck },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/repartos", label: "Reparto", icon: Route },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/cobranzas", label: "Cobranzas", icon: Wallet },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/reportes", label: "Reportes", icon: BarChart3 },
];

const QUICK_LINKS_LOGISTICA = [
  { href: "/repartos", label: "Reparto", icon: Route },
  { href: "/traslados", label: "Traslados", icon: ArrowLeftRight },
  { href: "/abastecimiento-campo", label: "Abastecimiento en campo", icon: PackagePlus },
  { href: "/inventario", label: "Inventario", icon: Boxes },
  { href: "/kardex", label: "Kardex", icon: ScrollText },
];

const QUICK_LINKS_REPARTIDOR = [
  { href: "/mis-repartos", label: "Mis repartos", icon: Route },
];

function quickLinksPorRol(rol: string) {
  if (rol === "logistica") return QUICK_LINKS_LOGISTICA;
  if (rol === "repartidor") return QUICK_LINKS_REPARTIDOR;
  return QUICK_LINKS_COMPLETO;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: usuario } = user
    ? await supabase.from("usuarios").select("rol").eq("id", user.id).maybeSingle()
    : { data: null };
  const QUICK_LINKS = quickLinksPorRol(usuario?.rol ?? "vendedor");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-8 text-white shadow-lg shadow-emerald-900/10">
          <h1 className="text-2xl font-semibold">Bienvenido a Qhatu</h1>
          <p className="mt-1 text-sm text-emerald-50">
            Sesión iniciada como{" "}
            <span className="font-medium">{user?.email}</span>
          </p>
        </div>

        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
              >
                <span className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white">
                  <Icon size={20} />
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {link.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

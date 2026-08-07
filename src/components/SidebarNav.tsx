"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  ClipboardList,
  Route,
  ShoppingCart,
  ShoppingBag,
  Wallet,
  Boxes,
  Warehouse,
  ScrollText,
  BarChart3,
  ShieldCheck,
  UserCog,
  Image,
  DatabaseBackup,
  FileText,
  Settings,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: "General",
    items: [{ href: "/dashboard", label: "Panel", icon: LayoutDashboard }],
  },
  {
    label: "Comercial",
    items: [
      { href: "/clientes", label: "Clientes", icon: Users },
      { href: "/productos", label: "Productos", icon: Package },
      { href: "/proveedores", label: "Proveedores", icon: Truck },
      { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
    ],
  },
  {
    label: "Logística",
    items: [
      { href: "/repartos", label: "Reparto", icon: Route },
      { href: "/inventario", label: "Inventario", icon: Boxes },
      { href: "/kardex", label: "Kardex", icon: ScrollText },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/compras", label: "Compras", icon: ShoppingBag },
      { href: "/ventas", label: "Ventas", icon: ShoppingCart },
      { href: "/comprobantes", label: "Comprobantes", icon: FileText },
      { href: "/cobranzas", label: "Cobranzas", icon: Wallet },
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
    ],
  },
];

export default function SidebarNav({
  isAdmin = false,
  onNavigate,
}: {
  isAdmin?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const groups = isAdmin
    ? [
        ...NAV_GROUPS,
        {
          label: "Administración",
          items: [
            { href: "/almacenes", label: "Almacenes", icon: Warehouse },
            { href: "/usuarios", label: "Usuarios", icon: UserCog },
            { href: "/auditoria", label: "Auditoría", icon: ShieldCheck },
            { href: "/evidencias-pago", label: "Evidencias de pago", icon: Image },
            { href: "/respaldo", label: "Respaldo de datos", icon: DatabaseBackup },
            {
              href: "/configuracion-facturacion",
              label: "Facturación electrónica",
              icon: Settings,
            },
          ],
        },
      ]
    : NAV_GROUPS;

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-emerald-200/70">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={
                    active
                      ? "flex items-center gap-3 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm"
                      : "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-emerald-700"
                  }
                >
                  <Icon size={18} strokeWidth={2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

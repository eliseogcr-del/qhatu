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
  ArrowLeftRight,
  PackagePlus,
  Factory,
  ScrollText,
  BarChart3,
  ShieldCheck,
  UserCog,
  Image,
  DatabaseBackup,
  FileText,
  Settings,
  Ruler,
  FileSpreadsheet,
} from "lucide-react";

const GENERAL = {
  label: "General",
  items: [{ href: "/dashboard", label: "Panel", icon: LayoutDashboard }],
};

const COMERCIAL = {
  label: "Comercial",
  items: [
    { href: "/clientes", label: "Clientes", icon: Users },
    { href: "/productos", label: "Productos", icon: Package },
    { href: "/proveedores", label: "Proveedores", icon: Truck },
    { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
    { href: "/cotizaciones", label: "Cotizaciones", icon: FileSpreadsheet },
  ],
};

const COMERCIAL_LOGISTICA = {
  label: "Comercial",
  items: [{ href: "/cotizaciones", label: "Cotizaciones", icon: FileSpreadsheet }],
};

const LOGISTICA = {
  label: "Logística",
  items: [
    { href: "/repartos", label: "Reparto", icon: Route },
    { href: "/traslados", label: "Traslados", icon: ArrowLeftRight },
    { href: "/abastecimiento-campo", label: "Abastecimiento en campo", icon: PackagePlus },
    { href: "/produccion", label: "Producción", icon: Factory },
    { href: "/inventario", label: "Inventario", icon: Boxes },
    { href: "/kardex", label: "Kardex", icon: ScrollText },
  ],
};

const FINANZAS = {
  label: "Finanzas",
  items: [
    { href: "/compras", label: "Compras", icon: ShoppingBag },
    { href: "/ventas", label: "Ventas", icon: ShoppingCart },
    { href: "/comprobantes", label: "Comprobantes", icon: FileText },
    { href: "/cobranzas", label: "Cobranzas", icon: Wallet },
    { href: "/reportes", label: "Reportes", icon: BarChart3 },
  ],
};

const FINANZAS_LOGISTICA = {
  label: "Finanzas",
  items: [{ href: "/compras", label: "Compras", icon: ShoppingBag }],
};

const ADMINISTRACION = {
  label: "Administración",
  items: [
    { href: "/almacenes", label: "Almacenes", icon: Warehouse },
    { href: "/unidades-medida", label: "Unidades de medida", icon: Ruler },
    { href: "/configuracion-cotizaciones", label: "Config. cotizaciones", icon: FileSpreadsheet },
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
};

const MIS_REPARTOS = {
  label: "Reparto",
  items: [{ href: "/mis-repartos", label: "Mis repartos", icon: Route }],
};

const COMERCIAL_VENDEDOR = {
  label: "Comercial",
  items: [
    { href: "/pedidos", label: "Pedidos", icon: ClipboardList },
    { href: "/cotizaciones", label: "Cotizaciones", icon: FileSpreadsheet },
  ],
};

const LOGISTICA_VENDEDOR = {
  label: "Logística",
  items: [
    { href: "/traslados", label: "Traslados", icon: ArrowLeftRight },
    { href: "/abastecimiento-campo", label: "Abastecimiento en campo", icon: PackagePlus },
    { href: "/inventario", label: "Inventario", icon: Boxes },
    { href: "/kardex", label: "Kardex", icon: ScrollText },
  ],
};

const FINANZAS_VENDEDOR = {
  label: "Finanzas",
  items: [
    { href: "/ventas", label: "Ventas", icon: ShoppingCart },
    { href: "/reportes", label: "Reportes", icon: BarChart3 },
  ],
};

function gruposPorRol(rol: string) {
  if (rol === "admin") return [GENERAL, COMERCIAL, LOGISTICA, FINANZAS, ADMINISTRACION];
  if (rol === "logistica")
    return [GENERAL, COMERCIAL_LOGISTICA, LOGISTICA, FINANZAS_LOGISTICA];
  if (rol === "repartidor") return [GENERAL, MIS_REPARTOS];
  // vendedor (y cualquier valor no reconocido): solo Pedidos, Abastecimiento
  // en campo (para registrar lo que recibe en ruta) y Ventas.
  return [GENERAL, COMERCIAL_VENDEDOR, LOGISTICA_VENDEDOR, FINANZAS_VENDEDOR];
}

export default function SidebarNav({
  rol = "vendedor",
  onNavigate,
}: {
  rol?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = gruposPorRol(rol);

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

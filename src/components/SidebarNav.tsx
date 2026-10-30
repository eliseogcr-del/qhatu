"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
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
  Tags,
  Tag,
  Zap,
  ClipboardCheck,
  KeyRound,
  type LucideIcon,
} from "lucide-react";
import { OPCIONES_SISTEMA } from "@/lib/opciones-sistema";

// Un ícono por código de opción — puramente presentacional, por eso vive
// acá (SidebarNav es el único lado "cliente" de esto) y no en el catálogo
// compartido (que también importa el proxy, en Edge).
const ICONOS: Record<string, LucideIcon> = {
  "/clientes": Users,
  "/productos": Package,
  "/proveedores": Truck,
  "/pedidos": ClipboardList,
  "/cotizaciones": FileSpreadsheet,
  "/repartos": Route,
  "/mis-repartos": Route,
  "/traslados": ArrowLeftRight,
  "/abastecimiento-campo": PackagePlus,
  "/produccion": Factory,
  "/inventario": Boxes,
  "/kardex": ScrollText,
  "/reportes/cuadro-control": ClipboardCheck,
  "/promociones": Tag,
  "/ventas/rapida": Zap,
  "/ventas/directa": Zap,
  "/compras": ShoppingBag,
  "/ventas/mis-ventas": ShoppingCart,
  "/ventas": ShoppingCart,
  "/comprobantes": FileText,
  "/comprobantes-libres": FileSpreadsheet,
  "/cobranzas": Wallet,
  "/reportes": BarChart3,
};

type Item = { href: string; label: string; icon: LucideIcon };
type Grupo = { label: string; items: Item[] };

const GENERAL: Grupo = {
  label: "General",
  items: [{ href: "/dashboard", label: "Panel", icon: LayoutDashboard }],
};

// Exclusivo de administrador — no pasa por el catálogo de opciones ni es
// asignable a nadie más (ver opciones-sistema.ts).
const ADMINISTRACION: Grupo = {
  label: "Administración",
  items: [
    { href: "/almacenes", label: "Almacenes", icon: Warehouse },
    { href: "/unidades-medida", label: "Unidades de medida", icon: Ruler },
    { href: "/configuracion-precios", label: "Config. precios", icon: Tags },
    { href: "/configuracion-cotizaciones", label: "Config. cotizaciones", icon: FileSpreadsheet },
    { href: "/usuarios", label: "Usuarios", icon: UserCog },
    { href: "/usuarios/permisos", label: "Permisos", icon: KeyRound },
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

// "Mis repartos" no tiene lugar propio en el menú lateral — quien lo
// tiene concedido (normalmente el repartidor) ya llega ahí desde su
// tarjeta de acceso rápido en el Panel; mostrarlo también acá sería
// redundante, sobre todo porque "Reparto (todos)" ya cubre lo mismo
// para quien ve todos los repartos. Sigue existiendo como opción
// asignable en Permisos y el proxy lo sigue protegiendo igual — esto
// solo oculta el enlace del menú.
const OCULTAS_DEL_MENU = new Set(["/mis-repartos"]);

// Arma el menú de un usuario a partir de las opciones que tiene
// concedidas (usuario_opciones) — admin ve el catálogo completo siempre,
// sin importar qué tenga o no concedido. Los grupos sin ningún item
// concedido ni siquiera aparecen.
function gruposPorOpciones(rol: string, opciones: Set<string>): Grupo[] {
  const esAdmin = rol === "admin";
  const porGrupo = new Map<string, Item[]>();
  for (const opcion of OPCIONES_SISTEMA) {
    if (OCULTAS_DEL_MENU.has(opcion.codigo)) continue;
    if (!esAdmin && !opciones.has(opcion.codigo)) continue;
    const icon = ICONOS[opcion.codigo] ?? FileText;
    const item: Item = { href: opcion.codigo, label: opcion.etiqueta, icon };
    porGrupo.set(opcion.grupo, [...(porGrupo.get(opcion.grupo) ?? []), item]);
  }

  const grupos: Grupo[] = [GENERAL];
  for (const label of ["Comercial", "Logística", "Finanzas"]) {
    const items = porGrupo.get(label);
    if (items && items.length > 0) grupos.push({ label, items });
  }
  if (esAdmin) grupos.push(ADMINISTRACION);
  return grupos;
}

export default function SidebarNav({
  rol = "vendedor",
  opciones = [],
  onNavigate,
}: {
  rol?: string;
  opciones?: string[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = gruposPorOpciones(rol, new Set(opciones));

  // Qué grupos están colapsados (ej. "Comercial", "Logística") — se guarda
  // en localStorage del navegador para que se mantenga al navegar entre
  // pantallas. Arranca con todos expandidos y recién en el cliente se
  // ajusta según lo guardado, para no depender de cookies solo por esto.
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const guardado = localStorage.getItem("qhatu-sidebar-grupos-colapsados");
      if (guardado) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setColapsados(new Set(JSON.parse(guardado)));
      }
    } catch {
      // Almacenamiento no disponible (modo privado, etc.) — se queda todo expandido.
    }
  }, []);

  function alternarGrupo(label: string) {
    setColapsados((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        localStorage.setItem("qhatu-sidebar-grupos-colapsados", JSON.stringify([...next]));
      } catch {
        // Sin persistencia disponible, igual cambia para esta sesión.
      }
      return next;
    });
  }

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {groups.map((group) => {
        const abierto = !colapsados.has(group.label);
        return (
        <div key={group.label}>
          <button
            type="button"
            onClick={() => alternarGrupo(group.label)}
            className="mb-2 flex w-full items-center justify-between px-3 text-xs font-semibold uppercase tracking-wider text-emerald-200/70 hover:text-emerald-100"
          >
            {group.label}
            {abierto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          {abierto && (
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
          )}
        </div>
        );
      })}
    </nav>
  );
}

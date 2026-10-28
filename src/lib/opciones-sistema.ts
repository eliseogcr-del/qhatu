// Catálogo único de "opciones del sistema" — lo usa el módulo de Permisos
// (árbol de checks), el sidebar (arma el menú de cada usuario según sus
// opciones concedidas) y el proxy/middleware (bloquea la navegación
// directa a una ruta si el usuario no tiene la opción que le corresponde).
// Sin icono a propósito: este archivo lo importa el proxy, que corre en
// Edge — se mantiene liviano y sin dependencias de React/lucide-react; el
// ícono de cada opción vive aparte, en SidebarNav.
//
// "codigo" es el prefijo de ruta de esa opción — el proxy hace match por
// el prefijo MÁS LARGO que calce (ver mejorOpcionParaRuta), así que un
// código más específico (ej. "/ventas/rapida") siempre gana sobre uno más
// genérico que lo contiene (ej. "/ventas") sin necesidad de orden
// particular en este arreglo.
//
// Lo que NO está acá (Almacenes, Usuarios, Auditoría, Respaldo,
// Configuración de precios/cotizaciones/facturación, y este mismo módulo
// de Permisos) sigue siendo exclusivo de admin, como hasta ahora — nunca
// aparece en el árbol de Permisos ni se le puede conceder a nadie más.
export type OpcionSistema = {
  codigo: string;
  etiqueta: string;
  grupo: "Comercial" | "Logística" | "Finanzas";
};

export const OPCIONES_SISTEMA: OpcionSistema[] = [
  // Comercial
  { codigo: "/clientes", etiqueta: "Clientes", grupo: "Comercial" },
  { codigo: "/productos", etiqueta: "Productos", grupo: "Comercial" },
  { codigo: "/proveedores", etiqueta: "Proveedores", grupo: "Comercial" },
  { codigo: "/pedidos", etiqueta: "Pedidos", grupo: "Comercial" },
  { codigo: "/cotizaciones", etiqueta: "Cotizaciones", grupo: "Comercial" },
  // Logística
  { codigo: "/repartos", etiqueta: "Reparto (todos)", grupo: "Logística" },
  { codigo: "/mis-repartos", etiqueta: "Mis repartos", grupo: "Logística" },
  { codigo: "/traslados", etiqueta: "Traslados", grupo: "Logística" },
  { codigo: "/abastecimiento-campo", etiqueta: "Abastecimiento en campo", grupo: "Logística" },
  { codigo: "/produccion", etiqueta: "Producción", grupo: "Logística" },
  { codigo: "/inventario", etiqueta: "Inventario", grupo: "Logística" },
  { codigo: "/kardex", etiqueta: "Kardex", grupo: "Logística" },
  { codigo: "/reportes/cuadro-control", etiqueta: "Cuadro de Control de Productos", grupo: "Logística" },
  { codigo: "/promociones", etiqueta: "Promociones", grupo: "Logística" },
  // Finanzas
  { codigo: "/ventas/rapida", etiqueta: "Venta rápida", grupo: "Finanzas" },
  { codigo: "/ventas/directa", etiqueta: "Venta directa", grupo: "Finanzas" },
  { codigo: "/compras", etiqueta: "Compras", grupo: "Finanzas" },
  { codigo: "/ventas/mis-ventas", etiqueta: "Mis ventas", grupo: "Finanzas" },
  { codigo: "/ventas", etiqueta: "Ventas", grupo: "Finanzas" },
  { codigo: "/comprobantes", etiqueta: "Comprobantes", grupo: "Finanzas" },
  { codigo: "/comprobantes-libres", etiqueta: "Comprobantes libres", grupo: "Finanzas" },
  { codigo: "/cobranzas", etiqueta: "Cobranzas", grupo: "Finanzas" },
  { codigo: "/reportes", etiqueta: "Reportes", grupo: "Finanzas" },
];

export const GRUPOS_OPCIONES = ["Comercial", "Logística", "Finanzas"] as const;

// La ruta "/dashboard" siempre es visible/accesible para cualquier
// usuario autenticado (es el panel al que cae todo el mundo) — nunca
// pasa por este catálogo ni se puede desmarcar.
const SIEMPRE_PERMITIDAS = ["/dashboard", "/login", "/auth"];

export function rutaSiempreLibre(pathname: string): boolean {
  return SIEMPRE_PERMITIDAS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Qué opciones le tocan por defecto a un usuario NUEVO según su rol (y,
// para vendedor, si su almacén es digital) — el mismo criterio que usó
// la migración 20261028000000 para no cambiarle el menú a nadie que ya
// existía. Se usa al crear un usuario (usuarios/actions.ts) para que
// arranque viendo lo mismo que vería por rol, igual que hasta ahora; el
// admin lo ajusta después desde Permisos si hace falta algo distinto.
export function opcionesPorDefectoParaRol(rol: string, almacenEsDigital: boolean): string[] {
  switch (rol) {
    case "admin":
      return [];
    case "logistica":
      return [
        "/pedidos", "/cotizaciones",
        "/repartos", "/traslados", "/abastecimiento-campo", "/produccion",
        "/inventario", "/kardex", "/reportes/cuadro-control", "/promociones",
        "/ventas/rapida", "/ventas", "/comprobantes-libres",
      ];
    case "repartidor":
      return ["/mis-repartos"];
    case "produccion":
      return ["/produccion"];
    case "contador":
      return ["/comprobantes", "/comprobantes-libres"];
    default:
      return almacenEsDigital
        ? [
            "/ventas/directa", "/ventas/rapida",
            "/clientes", "/pedidos", "/cotizaciones",
            "/repartos", "/traslados", "/inventario", "/kardex", "/reportes/cuadro-control",
            "/ventas",
          ]
        : [
            "/ventas/rapida",
            "/cotizaciones",
            "/traslados", "/abastecimiento-campo", "/reportes/cuadro-control",
            "/ventas/mis-ventas",
          ];
  }
}

// Empareja un pathname con la opción del catálogo cuyo código sea el
// prefijo MÁS ESPECÍFICO (más largo) que calce — así "/ventas/rapida"
// nunca cae bajo la opción genérica "/ventas". Devuelve null si el
// pathname no corresponde a ninguna opción gestionada (esas rutas no se
// tocan — ver rutaSiempreLibre y el comentario de arriba sobre qué queda
// fuera del catálogo a propósito).
export function mejorOpcionParaRuta(pathname: string): OpcionSistema | null {
  let mejor: OpcionSistema | null = null;
  for (const opcion of OPCIONES_SISTEMA) {
    const calza = pathname === opcion.codigo || pathname.startsWith(`${opcion.codigo}/`);
    if (calza && (!mejor || opcion.codigo.length > mejor.codigo.length)) {
      mejor = opcion;
    }
  }
  return mejor;
}

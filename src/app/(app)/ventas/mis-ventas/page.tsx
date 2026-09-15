import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { fetchVentasConSaldo } from "@/utils/supabase/ventas";
import { hoyLima } from "@/lib/fecha";
import MisVentasView from "@/components/MisVentasView";

// Módulo aparte del listado de Ventas normal (tabla ancha, pensada para
// escritorio) — esta es la versión para el vendedor de almacén móvil:
// tarjetas grandes en vez de tabla, filtros que se pueden ocultar, y el
// total vendido arriba de todo para verlo de un vistazo. No toca
// ventas/page.tsx ni VentaFilaExpandible, que siguen igual para el resto
// de almacenes y roles.
export default async function MisVentasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; desde?: string; hasta?: string; pendientes?: string }>;
}) {
  const { q, desde, hasta, pendientes } = await searchParams;
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);

  const hoy = hoyLima();
  const desdeEfectivo = desde === undefined ? hoy : desde;
  const hastaEfectivo = hasta === undefined ? hoy : hasta;

  const { ventas, error } = await fetchVentasConSaldo(supabase, {
    clienteNombre: q,
    fechaDesde: desdeEfectivo,
    fechaHasta: hastaEfectivo,
    soloPendientes: pendientes === "1",
    almacenId: session.almacenId,
  });

  const hayFiltros = !!(q || desde !== undefined || hasta !== undefined || pendientes);

  const ventasActivas = ventas.filter((v) => v.estado !== "anulada");
  const monedaResumen = ventasActivas[0]?.moneda ?? "PEN";
  const totalVendido =
    Math.round(ventasActivas.reduce((acc, v) => acc + (v.total - v.descuento), 0) * 100) / 100;

  // Para que "Volver al listado" en el detalle de la venta regrese
  // exactamente a esta URL (con filtros) — mismo patrón que el resto del
  // sistema (ver VentaFilaExpandible).
  const volverParams = new URLSearchParams();
  if (q) volverParams.set("q", q);
  if (desde !== undefined) volverParams.set("desde", desde);
  if (hasta !== undefined) volverParams.set("hasta", hasta);
  if (pendientes) volverParams.set("pendientes", pendientes);
  const volverQs = volverParams.toString();
  const volverUrl = `/ventas/mis-ventas${volverQs ? `?${volverQs}` : ""}`;

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <MisVentasView
          ventas={ventas}
          error={error}
          q={q ?? ""}
          desde={desdeEfectivo}
          hasta={hastaEfectivo}
          pendientes={pendientes === "1"}
          hayFiltros={hayFiltros}
          monedaResumen={monedaResumen}
          totalVendido={totalVendido}
          volverUrl={volverUrl}
        />
      </div>
    </div>
  );
}

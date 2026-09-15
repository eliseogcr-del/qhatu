import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { fetchVentasConSaldo } from "@/utils/supabase/ventas";
import { hoyLima, formatFecha } from "@/lib/fecha";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import MisVentasFiltroForm from "@/components/MisVentasFiltroForm";

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
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Mis ventas</h1>
          <Link
            href="/dashboard"
            className="flex items-center gap-1 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Panel
          </Link>
        </div>

        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-emerald-900">Total vendido</span>
            <span className="text-2xl font-extrabold text-emerald-900">
              {monedaResumen} {totalVendido.toFixed(2)}
            </span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-emerald-700">
            {ventas.length} {ventas.length === 1 ? "venta" : "ventas"}
          </p>
        </div>

        <MisVentasFiltroForm
          q={q ?? ""}
          desde={desdeEfectivo}
          hasta={hastaEfectivo}
          pendientes={pendientes === "1"}
          hayFiltros={hayFiltros}
        />

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-base font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {ventas.map((venta) => {
            const pagada = venta.saldo <= 0;
            return (
              <Link
                key={venta.id}
                href={`/ventas/${venta.id}?volver=${encodeURIComponent(volverUrl)}`}
                className="block rounded-xl border-2 border-gray-200 bg-white p-4 shadow-sm active:bg-gray-50"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-base font-bold text-gray-900">
                    {venta.comprobante_tipo != null
                      ? `${TIPO_COMPROBANTE_LABEL[venta.comprobante_tipo] ?? "Comprobante"} ${venta.comprobante_numero ?? ""}`
                      : "Sin comprobante"}
                  </span>
                  <span
                    className={
                      venta.estado === "anulada"
                        ? "shrink-0 rounded-full bg-red-100 px-2.5 py-1 text-sm font-bold text-red-700"
                        : "shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-sm font-bold text-green-700"
                    }
                  >
                    {venta.estado === "anulada" ? "Anulada" : "Completado"}
                  </span>
                </div>
                <p className="text-lg font-bold text-gray-900">{venta.cliente_nombre ?? "—"}</p>
                <p className="mb-2 text-sm font-medium text-gray-500">{formatFecha(venta.fecha)}</p>
                <div className="flex items-center justify-between">
                  <span
                    className={
                      pagada
                        ? "rounded-full bg-gray-100 px-2.5 py-1 text-sm font-bold text-gray-600"
                        : "rounded-full bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-700"
                    }
                  >
                    {pagada ? "Pagado" : `Debe ${venta.moneda} ${venta.saldo.toFixed(2)}`}
                  </span>
                  <span className="text-xl font-extrabold text-gray-900">
                    {venta.moneda} {venta.total.toFixed(2)}
                  </span>
                </div>
              </Link>
            );
          })}

          {ventas.length === 0 && (
            <p className="rounded-xl border-2 border-gray-200 bg-white p-6 text-center text-base font-medium text-gray-400">
              {hayFiltros ? "Ninguna venta coincide con los filtros." : "Aún no hay ventas registradas."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

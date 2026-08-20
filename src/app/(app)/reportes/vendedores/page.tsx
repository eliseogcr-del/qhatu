import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { inicioDiaLima, finDiaLima } from "@/lib/fecha";

type Fila = {
  almacenId: string;
  almacenNombre: string;
  vendedorNombre: string;
  numVentas: number;
  totalVendido: number;
  totalCobrado: number;
};

export default async function ReporteVendedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const supabase = await createClient();

  const { data: usuariosConAlmacen } = await supabase
    .from("usuarios")
    .select("id, nombre, almacen_id")
    .not("almacen_id", "is", null);

  let ventasQuery = supabase
    .from("ventas")
    .select("id, total, fecha, almacen_id, almacenes(nombre)")
    .neq("estado", "anulada");
  if (desde) ventasQuery = ventasQuery.gte("fecha", inicioDiaLima(desde));
  if (hasta) ventasQuery = ventasQuery.lte("fecha", finDiaLima(hasta));
  const { data: ventas, error } = await ventasQuery;

  const ventaIds = (ventas ?? []).map((v) => v.id);
  const { data: cobranzas } =
    ventaIds.length > 0
      ? await supabase
          .from("cobranzas")
          .select("venta_id, monto")
          .in("venta_id", ventaIds)
          .eq("estado", "activa")
      : { data: [] as { venta_id: string | null; monto: number }[] };

  const cobradoPorVenta = new Map<string, number>();
  for (const c of cobranzas ?? []) {
    if (!c.venta_id) continue;
    cobradoPorVenta.set(c.venta_id, (cobradoPorVenta.get(c.venta_id) ?? 0) + c.monto);
  }

  const mapa = new Map<string, Fila>();
  for (const v of ventas ?? []) {
    const almacen = v.almacenes as unknown as { nombre: string } | null;
    if (!mapa.has(v.almacen_id)) {
      const vendedores = (usuariosConAlmacen ?? [])
        .filter((u) => u.almacen_id === v.almacen_id)
        .map((u) => u.nombre ?? "—");
      mapa.set(v.almacen_id, {
        almacenId: v.almacen_id,
        almacenNombre: almacen?.nombre ?? "—",
        vendedorNombre: vendedores.length > 0 ? vendedores.join(", ") : "Sin vendedor asignado",
        numVentas: 0,
        totalVendido: 0,
        totalCobrado: 0,
      });
    }
    const fila = mapa.get(v.almacen_id)!;
    fila.numVentas += 1;
    fila.totalVendido = Math.round((fila.totalVendido + v.total) * 100) / 100;
    fila.totalCobrado =
      Math.round((fila.totalCobrado + (cobradoPorVenta.get(v.id) ?? 0)) * 100) / 100;
  }

  const filas = [...mapa.values()].sort((a, b) => b.totalVendido - a.totalVendido);
  const hayFiltros = !!(desde || hasta);

  const totales = filas.reduce(
    (acc, f) => ({
      numVentas: acc.numVentas + f.numVentas,
      totalVendido: Math.round((acc.totalVendido + f.totalVendido) * 100) / 100,
      totalCobrado: Math.round((acc.totalCobrado + f.totalCobrado) * 100) / 100,
    }),
    { numVentas: 0, totalVendido: 0, totalCobrado: 0 },
  );
  const saldoTotal = Math.round((totales.totalVendido - totales.totalCobrado) * 100) / 100;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Ventas por vendedor</h1>
          <Link
            href="/reportes"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver a reportes
          </Link>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Ventas agrupadas por el almacén de cada vendedor (un vendedor de
          campo = un almacén). Las ventas anuladas no se cuentan.
        </p>

        <form className="mb-4 flex items-end gap-3" method="get">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/reportes/vendedores"
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Limpiar
            </Link>
          )}
        </form>

        <p className="mb-4 text-xs text-gray-400">
          Los montos asumen una sola moneda por simplicidad (no convierten PEN/USD).
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Vendedor</th>
                <th className="px-4 py-3 font-bold">Almacén</th>
                <th className="px-4 py-3 font-bold"># Ventas</th>
                <th className="px-4 py-3 font-bold">Total vendido</th>
                <th className="px-4 py-3 font-bold">Total cobrado</th>
                <th className="px-4 py-3 font-bold">Saldo pendiente</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const saldo = Math.round((f.totalVendido - f.totalCobrado) * 100) / 100;
                return (
                  <tr key={f.almacenId} className="border-b-2 border-gray-200 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{f.vendedorNombre}</td>
                    <td className="px-4 py-3 text-gray-600">{f.almacenNombre}</td>
                    <td className="px-4 py-3 text-gray-600">{f.numVentas}</td>
                    <td className="px-4 py-3 text-gray-600">{f.totalVendido.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-600">{f.totalCobrado.toFixed(2)}</td>
                    <td
                      className={`px-4 py-3 font-medium ${saldo > 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {saldo.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ninguna venta en este rango."
                      : "Aún no hay ventas registradas."}
                  </td>
                </tr>
              )}
            </tbody>
            {filas.length > 0 && (
              <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-semibold text-gray-900">
                <tr>
                  <td className="px-4 py-3" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-3">{totales.numVentas}</td>
                  <td className="px-4 py-3">{totales.totalVendido.toFixed(2)}</td>
                  <td className="px-4 py-3">{totales.totalCobrado.toFixed(2)}</td>
                  <td className={saldoTotal > 0 ? "px-4 py-3 text-red-600" : "px-4 py-3 text-green-600"}>
                    {saldoTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

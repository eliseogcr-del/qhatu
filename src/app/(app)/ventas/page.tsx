import Link from "next/link";
import { FileDown, Plus, Search, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { fetchVentasConSaldo } from "@/utils/supabase/ventas";

function buildExportHref(params: {
  q?: string;
  desde?: string;
  hasta?: string;
  pendientes?: string;
}) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.desde) search.set("desde", params.desde);
  if (params.hasta) search.set("hasta", params.hasta);
  if (params.pendientes) search.set("pendientes", params.pendientes);
  const qs = search.toString();
  return `/ventas/export${qs ? `?${qs}` : ""}`;
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    desde?: string;
    hasta?: string;
    pendientes?: string;
  }>;
}) {
  const { q, desde, hasta, pendientes } = await searchParams;
  const supabase = await createClient();

  const { ventas, error } = await fetchVentasConSaldo(supabase, {
    clienteNombre: q,
    fechaDesde: desde,
    fechaHasta: hasta,
    soloPendientes: pendientes === "1",
  });

  const hayFiltros = !!(q || desde || hasta || pendientes);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Ventas</h1>
          <div className="flex items-center gap-3">
            <a
              href={buildExportHref({ q, desde, hasta, pendientes })}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={16} />
              Exportar a Excel
            </a>
            <Link
              href="/ventas/nueva"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus size={16} />
              Registrar venta
            </Link>
          </div>
        </div>

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cliente
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por nombre..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Desde
            </label>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Hasta
            </label>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="pendientes"
              value="1"
              defaultChecked={pendientes === "1"}
              className="h-4 w-4 rounded border-gray-300"
            />
            Solo pendientes de pago
          </label>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/ventas"
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Limpiar
            </Link>
          )}
        </form>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Cobrado</th>
                <th className="px-4 py-3 font-medium">Saldo pendiente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {ventas.map((venta) => (
                <tr key={venta.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {venta.cliente_nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(venta.fecha).toLocaleDateString("es-PE")}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {venta.moneda} {venta.total.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {venta.moneda} {venta.cobrado.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        venta.saldo > 0
                          ? "font-semibold text-red-600"
                          : "font-semibold text-green-600"
                      }
                    >
                      {venta.moneda} {venta.saldo.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                      {venta.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/ventas/${venta.id}`}
                      className="text-sm font-medium text-gray-700 hover:underline"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}

              {ventas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ninguna venta coincide con los filtros."
                      : "Aún no hay ventas registradas."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

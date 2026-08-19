import Link from "next/link";
import { FileDown, Plus, Search, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { fetchComprasConSaldo } from "@/utils/supabase/compras";
import CompraFilaExpandible from "@/components/CompraFilaExpandible";

function buildExportHref(
  base: "/compras/export" | "/compras/export-detalle",
  params: {
    q?: string;
    desde?: string;
    hasta?: string;
    pendientes?: string;
  },
) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.desde) search.set("desde", params.desde);
  if (params.hasta) search.set("hasta", params.hasta);
  if (params.pendientes) search.set("pendientes", params.pendientes);
  const qs = search.toString();
  return `${base}${qs ? `?${qs}` : ""}`;
}

export default async function ComprasPage({
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

  const { compras, error } = await fetchComprasConSaldo(supabase, {
    proveedorNombre: q,
    fechaDesde: desde,
    fechaHasta: hasta,
    soloPendientes: pendientes === "1",
  });

  const hayFiltros = !!(q || desde || hasta || pendientes);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Compras</h1>
          <div className="flex items-center gap-3">
            <a
              href={buildExportHref("/compras/export", { q, desde, hasta, pendientes })}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={16} />
              Exportar resumen
            </a>
            <a
              href={buildExportHref("/compras/export-detalle", { q, desde, hasta, pendientes })}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={16} />
              Exportar detalle de pagos
            </a>
            <Link
              href="/compras/nueva"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus size={16} />
              Registrar compra
            </Link>
          </div>
        </div>

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Proveedor
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
              href="/compras"
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

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-2 py-3" />
                <th className="px-4 py-3 font-bold">Código</th>
                <th className="px-4 py-3 font-bold">Proveedor</th>
                <th className="px-4 py-3 font-bold">Local</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Pagado</th>
                <th className="px-4 py-3 font-bold">Saldo pendiente</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {compras.map((compra) => (
                <CompraFilaExpandible key={compra.id} compra={compra} />
              ))}

              {compras.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ninguna compra coincide con los filtros."
                      : "Aún no hay compras registradas."}
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

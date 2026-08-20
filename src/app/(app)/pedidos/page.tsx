import Link from "next/link";
import { formatFecha, hoyLima, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { Plus, FileDown, Search, Eye, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import {
  ESTADOS_PEDIDO,
  ESTADO_BADGE,
  ESTADO_LABEL,
  canalLabel,
  type EstadoPedido,
} from "@/lib/pedido-estados";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; desde?: string; hasta?: string; estado?: string }>;
}) {
  const { q, desde, hasta, estado } = await searchParams;
  const supabase = await createClient();

  // Sin parámetros en la URL (primera carga) se muestra el día de hoy por
  // defecto. Si el usuario borra los campos de fecha y busca, quedan como
  // string vacío (presentes pero sin valor) y ahí sí se ven todos.
  const hoy = hoyLima();
  const desdeEfectivo = desde === undefined ? hoy : desde;
  const hastaEfectivo = hasta === undefined ? hoy : hasta;

  let query = supabase
    .from("pedidos")
    .select(
      q
        ? "id, fecha, fecha_entrega_requerida, canal_pedido, estado, moneda, total, clientes!inner(nombre), almacenes(nombre)"
        : "id, fecha, fecha_entrega_requerida, canal_pedido, estado, moneda, total, clientes(nombre), almacenes(nombre)",
    )
    .order("fecha", { ascending: false });

  if (q) query = query.ilike("clientes.nombre", `%${q}%`);
  if (desdeEfectivo) query = query.gte("fecha", inicioDiaLima(desdeEfectivo));
  if (hastaEfectivo) query = query.lte("fecha", finDiaLima(hastaEfectivo));
  if (estado) query = query.eq("estado", estado);

  const { data: pedidos, error } = await query;

  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (desdeEfectivo) exportParams.set("desde", desdeEfectivo);
  if (hastaEfectivo) exportParams.set("hasta", hastaEfectivo);
  if (estado) exportParams.set("estado", estado);
  const exportQs = exportParams.toString();

  const hayFiltros = !!(q || desde !== undefined || hasta !== undefined || estado);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Pedidos</h1>
          <div className="flex items-center gap-3">
            <a
              href={`/pedidos/export${exportQs ? `?${exportQs}` : ""}`}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={16} />
              Exportar a Excel
            </a>
            <Link
              href="/pedidos/nuevo"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus size={16} />
              Nuevo pedido
            </Link>
          </div>
        </div>

        <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
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
                placeholder="Buscar por cliente..."
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
              defaultValue={desdeEfectivo}
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
              defaultValue={hastaEfectivo}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Estado
            </label>
            <select
              name="estado"
              defaultValue={estado ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {ESTADOS_PEDIDO.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_LABEL[e]}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Buscar
          </button>
          {hayFiltros && (
            <Link
              href="/pedidos?desde=&hasta="
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Limpiar
            </Link>
          )}
        </form>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Local</th>
                <th className="px-4 py-3 font-bold">Canal</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Entrega requerida</th>
                <th className="px-4 py-3 font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pedidos?.map((pedido) => {
                const estadoPedido = pedido.estado as EstadoPedido;
                return (
                  <tr
                    key={pedido.id}
                    className="border-b-2 border-gray-200 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {(pedido.clientes as unknown as { nombre: string } | null)
                        ?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {(pedido.almacenes as unknown as { nombre: string } | null)
                        ?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {canalLabel(pedido.canal_pedido)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatFecha(pedido.fecha)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {pedido.fecha_entrega_requerida ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {pedido.moneda} {pedido.total}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_BADGE[estadoPedido]}`}
                      >
                        {ESTADO_LABEL[estadoPedido] ?? pedido.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/pedidos/${pedido.id}`}
                        className="flex items-center justify-end gap-1 text-sm font-medium text-gray-700 hover:underline"
                      >
                        <Eye size={14} />
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {pedidos?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ningún pedido coincide con los filtros."
                      : "Aún no hay pedidos registrados."}
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

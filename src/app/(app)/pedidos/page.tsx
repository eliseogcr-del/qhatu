import Link from "next/link";
import { Plus, FileDown, Search, Eye, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import {
  ESTADO_BADGE,
  ESTADO_LABEL,
  canalLabel,
  type EstadoPedido,
} from "@/lib/pedido-estados";

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("pedidos")
    .select(
      q
        ? "id, fecha, fecha_entrega_requerida, canal_pedido, estado, moneda, total, clientes!inner(nombre)"
        : "id, fecha, fecha_entrega_requerida, canal_pedido, estado, moneda, total, clientes(nombre)",
    )
    .order("fecha", { ascending: false });

  if (q) query = query.ilike("clientes.nombre", `%${q}%`);

  const { data: pedidos, error } = await query;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Pedidos</h1>
          <div className="flex items-center gap-3">
            <a
              href={`/pedidos/export${q ? `?q=${encodeURIComponent(q)}` : ""}`}
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

        <form className="mb-4 flex items-center gap-2" method="get">
          <div className="relative max-w-sm flex-1">
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
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Buscar
          </button>
          {q && (
            <Link
              href="/pedidos"
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

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Canal</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Entrega requerida</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {pedidos?.map((pedido) => {
                const estado = pedido.estado as EstadoPedido;
                return (
                  <tr
                    key={pedido.id}
                    className="border-b border-gray-100 last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {(pedido.clientes as unknown as { nombre: string } | null)
                        ?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {canalLabel(pedido.canal_pedido)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(pedido.fecha).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {pedido.fecha_entrega_requerida ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {pedido.moneda} {pedido.total}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_BADGE[estado]}`}
                      >
                        {ESTADO_LABEL[estado] ?? pedido.estado}
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
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    {q
                      ? `Ningún pedido de un cliente que coincida con "${q}".`
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

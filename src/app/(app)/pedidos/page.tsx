import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
  ESTADO_BADGE,
  ESTADO_LABEL,
  canalLabel,
  type EstadoPedido,
} from "@/lib/pedido-estados";

export default async function PedidosPage() {
  const supabase = await createClient();
  const { data: pedidos, error } = await supabase
    .from("pedidos")
    .select(
      "id, fecha, fecha_entrega_requerida, canal_pedido, estado, moneda, total, clientes(nombre)",
    )
    .order("fecha", { ascending: false });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Pedidos</h1>
          <Link
            href="/pedidos/nuevo"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            + Nuevo pedido
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
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
                        className="text-sm font-medium text-gray-700 hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {pedidos?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay pedidos registrados.
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

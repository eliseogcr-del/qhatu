import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { TIPO_DEVOLUCION_LABEL, type TipoDevolucion } from "@/lib/devolucion-tipos";

export default async function VentaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: venta } = await supabase
    .from("ventas")
    .select("*, clientes(nombre), pedidos(id)")
    .eq("id", id)
    .single();

  if (!venta) notFound();

  const { data: detalle } = await supabase
    .from("venta_detalle")
    .select("id, cantidad, cantidad_entregada, precio_unitario, subtotal, productos(nombre)")
    .eq("venta_id", id);

  const detalleIds = (detalle ?? []).map((d) => d.id);
  const { data: devoluciones } =
    detalleIds.length > 0
      ? await supabase
          .from("devoluciones")
          .select("id, venta_detalle_id, cantidad, motivo, tipo")
          .in("venta_detalle_id", detalleIds)
      : { data: [] as never[] };

  const cliente = venta.clientes as unknown as { nombre: string } | null;
  const pedido = venta.pedidos as unknown as { id: string } | null;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Venta a {cliente?.nombre ?? "—"}
          </h1>
          <Link
            href="/ventas"
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Fecha</p>
            <p className="font-medium text-gray-900">
              {new Date(venta.fecha).toLocaleString("es-PE")}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Moneda / tipo de cambio</p>
            <p className="font-medium text-gray-900">
              {venta.moneda} · {venta.tipo_cambio_aplicado}
            </p>
          </div>
          {pedido && (
            <div>
              <p className="text-sm text-gray-500">Pedido de origen</p>
              <Link
                href={`/pedidos/${pedido.id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                Ver pedido
              </Link>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Productos entregados
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="py-2 font-medium">Producto</th>
                <th className="py-2 font-medium">Pedido</th>
                <th className="py-2 font-medium">Entregado</th>
                <th className="py-2 font-medium">Precio unitario</th>
                <th className="py-2 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {detalle?.map((linea) => {
                const producto = linea.productos as unknown as { nombre: string } | null;
                const devolucion = devoluciones?.find(
                  (d) => d.venta_detalle_id === linea.id,
                );
                return (
                  <tr key={linea.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 text-gray-900">
                      {producto?.nombre ?? "—"}
                      {devolucion && (
                        <p className="mt-1 text-xs text-red-600">
                          Merma: {devolucion.cantidad} (
                          {TIPO_DEVOLUCION_LABEL[devolucion.tipo as TipoDevolucion] ??
                            devolucion.tipo}
                          {devolucion.motivo ? ` — ${devolucion.motivo}` : ""})
                        </p>
                      )}
                    </td>
                    <td className="py-2 text-gray-600">{linea.cantidad}</td>
                    <td className="py-2 text-gray-600">{linea.cantidad_entregada}</td>
                    <td className="py-2 text-gray-600">{linea.precio_unitario}</td>
                    <td className="py-2 text-gray-600">{linea.subtotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-right text-sm font-semibold text-gray-900">
            Total: {venta.moneda} {venta.total}
          </p>
        </div>
      </div>
    </div>
  );
}

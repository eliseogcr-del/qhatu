import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import {
  ESTADOS_PEDIDO,
  ESTADO_BADGE,
  ESTADO_LABEL,
  canalLabel,
  type EstadoPedido,
} from "@/lib/pedido-estados";
import { updateEstadoPedido } from "../actions";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";

export default async function PedidoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: pedido }, { data: detalle }, { data: adjuntos }] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select("*, clientes(nombre, telefono, direccion)")
        .eq("id", id)
        .single(),
      supabase
        .from("pedido_detalle")
        .select("id, cantidad, precio_unitario, subtotal, productos(nombre)")
        .eq("pedido_id", id),
      supabase
        .from("pedido_adjuntos")
        .select("id, tipo_archivo, url_archivo, fecha")
        .eq("pedido_id", id),
    ]);

  if (!pedido) notFound();

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, total, moneda")
    .eq("pedido_id", id)
    .maybeSingle();

  const { data: cobranzas } = await supabase
    .from("cobranzas")
    .select("id, fecha, monto, moneda, metodo_pago, tipo_pago, referencia")
    .eq(venta ? "venta_id" : "pedido_id", venta ? venta.id : id)
    .order("fecha", { ascending: false });

  const totalReferencia = venta ? venta.total : pedido.total;
  const monedaReferencia = venta ? venta.moneda : pedido.moneda;
  const cobrado = (cobranzas ?? []).reduce((acc, c) => acc + c.monto, 0);
  const saldoPendiente = totalReferencia - cobrado;

  const adjuntosConUrl = await Promise.all(
    (adjuntos ?? []).map(async (adjunto) => {
      const { data } = await supabase.storage
        .from("pedido-adjuntos")
        .createSignedUrl(adjunto.url_archivo, 60 * 60);
      return { ...adjunto, signedUrl: data?.signedUrl ?? null };
    }),
  );

  const cliente = pedido.clientes as unknown as {
    nombre: string;
    telefono: string | null;
    direccion: string | null;
  } | null;
  const estado = pedido.estado as EstadoPedido;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Pedido de {cliente?.nombre ?? "—"}
          </h1>
          <div className="flex items-center gap-4">
            <Link
              href={`/ventas/nueva?pedido_id=${id}`}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
            >
              Registrar venta
            </Link>
            <Link
              href={`/repartos/nuevo?pedido_id=${id}`}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Asignar reparto
            </Link>
            <Link
              href="/pedidos"
              className="text-sm font-medium text-gray-600 hover:underline"
            >
              ← Volver al listado
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Cliente</p>
            <p className="font-medium text-gray-900">{cliente?.nombre}</p>
            <p className="text-sm text-gray-500">{cliente?.telefono}</p>
            <p className="text-sm text-gray-500">{cliente?.direccion}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Canal</p>
            <p className="mb-2 font-medium text-gray-900">
              {canalLabel(pedido.canal_pedido)}
            </p>
            <p className="text-sm text-gray-500">Fecha del pedido</p>
            <p className="mb-2 font-medium text-gray-900">
              {new Date(pedido.fecha).toLocaleString("es-PE")}
            </p>
            <p className="text-sm text-gray-500">Entrega requerida</p>
            <p className="font-medium text-gray-900">
              {pedido.fecha_entrega_requerida ?? "—"}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Estado
            </h2>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_BADGE[estado]}`}
            >
              {ESTADO_LABEL[estado] ?? pedido.estado}
            </span>
          </div>
          <form
            action={async (formData: FormData) => {
              "use server";
              await updateEstadoPedido(id, String(formData.get("estado")));
            }}
            className="flex items-center gap-3"
          >
            <select
              name="estado"
              defaultValue={pedido.estado}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {ESTADOS_PEDIDO.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_LABEL[e]}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Actualizar estado
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Productos
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 text-gray-500">
              <tr>
                <th className="py-2 font-medium">Producto</th>
                <th className="py-2 font-medium">Cantidad</th>
                <th className="py-2 font-medium">Precio unitario</th>
                <th className="py-2 font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {detalle?.map((linea) => (
                <tr key={linea.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 text-gray-900">
                    {(linea.productos as unknown as { nombre: string } | null)
                      ?.nombre ?? "—"}
                  </td>
                  <td className="py-2 text-gray-600">{linea.cantidad}</td>
                  <td className="py-2 text-gray-600">{linea.precio_unitario}</td>
                  <td className="py-2 text-gray-600">{linea.subtotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-right text-sm font-semibold text-gray-900">
            Total: {pedido.moneda} {pedido.total}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Cobranzas
            </h2>
            <Link
              href={`/cobranzas/nueva?pedido_id=${id}`}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Registrar cobro
            </Link>
          </div>

          <p className="mb-4 text-sm">
            Saldo pendiente:{" "}
            <span
              className={`font-semibold ${saldoPendiente > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {monedaReferencia} {saldoPendiente.toFixed(2)}
            </span>{" "}
            <span className="text-gray-500">
              (sobre {venta ? "la venta" : "el pedido"}: {monedaReferencia}{" "}
              {totalReferencia})
            </span>
          </p>

          {cobranzas && cobranzas.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Monto</th>
                  <th className="py-2 font-medium">Método</th>
                  <th className="py-2 font-medium">Tipo</th>
                  <th className="py-2 font-medium">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {cobranzas.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 text-gray-600">
                      {new Date(c.fecha).toLocaleDateString("es-PE")}
                    </td>
                    <td className="py-2 text-gray-600">
                      {c.moneda} {c.monto}
                    </td>
                    <td className="py-2 text-gray-600">
                      {METODO_PAGO_LABEL[c.metodo_pago as MetodoPago] ?? c.metodo_pago}
                    </td>
                    <td className="py-2 text-gray-600">{c.tipo_pago}</td>
                    <td className="py-2 text-gray-600">{c.referencia ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Aún no hay cobros registrados.</p>
          )}
        </div>

        {adjuntosConUrl.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Adjuntos
            </h2>
            <ul className="space-y-2">
              {adjuntosConUrl.map((adjunto) => (
                <li key={adjunto.id}>
                  {adjunto.signedUrl ? (
                    <a
                      href={adjunto.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-gray-700 underline hover:text-gray-900"
                    >
                      {adjunto.url_archivo.split("/").pop()}
                    </a>
                  ) : (
                    <span className="text-sm text-gray-400">
                      {adjunto.url_archivo.split("/").pop()} (no disponible)
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

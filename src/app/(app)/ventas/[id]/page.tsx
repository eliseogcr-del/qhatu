import Link from "next/link";
import { Pencil, Ban, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { TIPO_DEVOLUCION_LABEL, type TipoDevolucion } from "@/lib/devolucion-tipos";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";
import ConfirmFormButton from "@/components/ConfirmFormButton";
import { anularVenta } from "./actions";
import { anularCobranza } from "../../cobranzas/actions";

export default async function VentaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: venta } = await supabase
    .from("ventas")
    .select("*, clientes(nombre), pedidos(id)")
    .eq("id", id)
    .single();

  if (!venta) notFound();

  const [{ data: detalle }, { data: cobranzas }] = await Promise.all([
    supabase
      .from("venta_detalle")
      .select("id, cantidad, cantidad_entregada, precio_unitario, subtotal, productos(nombre)")
      .eq("venta_id", id),
    supabase
      .from("cobranzas")
      .select("id, fecha, monto, moneda, metodo_pago, referencia, estado")
      .eq("venta_id", id)
      .order("fecha", { ascending: false }),
  ]);

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

  const cobrado = (cobranzas ?? [])
    .filter((c) => c.estado === "activa")
    .reduce((acc, c) => acc + c.monto, 0);
  const saldo = Math.round((venta.total - cobrado) * 100) / 100;
  const anulada = venta.estado === "anulada";
  const puedeEditar = !anulada && saldo > 0;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">
              Venta a {cliente?.nombre ?? "—"}
            </h1>
            <span
              className={
                anulada
                  ? "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                  : "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
              }
            >
              {anulada ? "Anulada" : "Registrada"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {puedeEditar && (
              <Link
                href={`/ventas/${id}/editar`}
                className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil size={16} />
                Editar venta
              </Link>
            )}
            {!anulada && (
              <ConfirmFormButton
                action={anularVenta.bind(null, id)}
                confirmMessage="¿Seguro que quieres anular esta venta? Quedará registrado en el log de auditoría."
                icon={<Ban size={16} />}
                pendingLabel="Anulando..."
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Anular venta
              </ConfirmFormButton>
            )}
            <Link
              href="/ventas"
              className="text-sm font-medium text-gray-600 hover:underline"
            >
              ← Volver al listado
            </Link>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {!anulada && saldo <= 0 && (
          <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-500">
            Esta venta ya está completamente pagada, por lo que no admite
            ediciones. Para corregirla, primero anula el cobro correspondiente.
          </p>
        )}

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

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Cobros
            </h2>
            {pedido && (
              <Link
                href={`/cobranzas/nueva?pedido_id=${pedido.id}`}
                className="text-sm font-medium text-emerald-700 hover:underline"
              >
                Registrar cobro
              </Link>
            )}
          </div>

          <p className="mb-4 text-sm">
            Saldo pendiente:{" "}
            <span
              className={`font-semibold ${saldo > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {venta.moneda} {saldo.toFixed(2)}
            </span>{" "}
            <span className="text-gray-500">
              (cobrado: {venta.moneda} {cobrado.toFixed(2)})
            </span>
          </p>

          {cobranzas && cobranzas.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  <th className="py-2 font-medium">Fecha</th>
                  <th className="py-2 font-medium">Monto</th>
                  <th className="py-2 font-medium">Método</th>
                  <th className="py-2 font-medium">Referencia</th>
                  <th className="py-2 font-medium">Estado</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {cobranzas.map((c) => (
                  <tr
                    key={c.id}
                    className={`border-b border-gray-100 last:border-0 ${c.estado === "anulada" ? "opacity-50" : ""}`}
                  >
                    <td className="py-2 text-gray-600">
                      {new Date(c.fecha).toLocaleDateString("es-PE")}
                    </td>
                    <td className="py-2 text-gray-600">
                      {c.moneda} {c.monto}
                    </td>
                    <td className="py-2 text-gray-600">
                      {METODO_PAGO_LABEL[c.metodo_pago as MetodoPago] ?? c.metodo_pago}
                    </td>
                    <td className="py-2 text-gray-600">{c.referencia ?? "—"}</td>
                    <td className="py-2">
                      <span
                        className={
                          c.estado === "anulada"
                            ? "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                            : "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                        }
                      >
                        {c.estado === "anulada" ? "Anulada" : "Activa"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {c.estado === "activa" && (
                        <ConfirmFormButton
                          action={anularCobranza.bind(null, c.id, `/ventas/${id}`)}
                          confirmMessage="¿Anular este cobro? Quedará registrado en el log de auditoría."
                          icon={<XCircle size={14} />}
                          pendingLabel="Anulando..."
                          className="border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Anular
                        </ConfirmFormButton>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">Aún no hay cobros registrados.</p>
          )}
        </div>
      </div>
    </div>
  );
}

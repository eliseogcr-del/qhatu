import Link from "next/link";
import { formatFecha, formatFechaHora } from "@/lib/fecha";
import { Ban, XCircle, Save } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { METODOS_PAGO, METODO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";
import ConfirmFormButton from "@/components/ConfirmFormButton";
import SubmitButton from "@/components/SubmitButton";
import { anularCompra, createPagoProveedor, anularPagoProveedor } from "../actions";

export default async function CompraDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: compra } = await supabase
    .from("compras")
    .select("*, proveedores(nombre)")
    .eq("id", id)
    .single();

  if (!compra) notFound();

  const [{ data: detalle }, { data: pagos }] = await Promise.all([
    supabase
      .from("compra_detalle")
      .select("id, cantidad, costo_unitario, subtotal, productos(nombre)")
      .eq("compra_id", id),
    supabase
      .from("pagos_proveedor")
      .select("id, fecha, monto, moneda, metodo_pago, referencia, estado")
      .eq("compra_id", id)
      .order("fecha", { ascending: false }),
  ]);

  const proveedor = compra.proveedores as unknown as { nombre: string } | null;
  const pagado = (pagos ?? [])
    .filter((p) => p.estado === "activa")
    .reduce((acc, p) => acc + p.monto, 0);
  const saldo = Math.round((compra.total - pagado) * 100) / 100;
  const anulada = compra.estado === "anulada";

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">
              Compra a {proveedor?.nombre ?? "—"}
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
            {!anulada && (
              <ConfirmFormButton
                action={anularCompra.bind(null, id)}
                confirmMessage="¿Seguro que quieres anular esta compra? Esto revierte el stock que había ingresado."
                icon={<Ban size={16} />}
                pendingLabel="Anulando..."
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Anular compra
              </ConfirmFormButton>
            )}
            <Link
              href="/compras"
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

        <div className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Fecha</p>
            <p className="font-medium text-gray-900">
              {formatFechaHora(compra.fecha)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Moneda / tipo de cambio</p>
            <p className="font-medium text-gray-900">
              {compra.moneda} · {compra.tipo_cambio_aplicado}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Productos comprados
          </h2>
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="py-2 font-bold">Producto</th>
                <th className="py-2 font-bold">Cantidad</th>
                <th className="py-2 font-bold">Costo unitario</th>
                <th className="py-2 font-bold">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {detalle?.map((linea) => {
                const producto = linea.productos as unknown as { nombre: string } | null;
                return (
                  <tr key={linea.id} className="border-b-2 border-gray-200 last:border-0">
                    <td className="py-2 text-gray-900">{producto?.nombre ?? "—"}</td>
                    <td className="py-2 text-gray-600">{linea.cantidad}</td>
                    <td className="py-2 text-gray-600">{linea.costo_unitario}</td>
                    <td className="py-2 text-gray-600">{linea.subtotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 text-right text-sm font-semibold text-gray-900">
            Total: {compra.moneda} {compra.total}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Pagos al proveedor
          </h2>

          <p className="mb-4 text-sm">
            Saldo pendiente:{" "}
            <span
              className={`font-semibold ${saldo > 0 ? "text-red-600" : "text-green-600"}`}
            >
              {compra.moneda} {saldo.toFixed(2)}
            </span>{" "}
            <span className="text-gray-500">
              (pagado: {compra.moneda} {pagado.toFixed(2)})
            </span>
          </p>

          {pagos && pagos.length > 0 ? (
            <table className="mb-6 w-full text-left text-sm">
              <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
                <tr>
                  <th className="py-2 font-bold">Fecha</th>
                  <th className="py-2 font-bold">Monto</th>
                  <th className="py-2 font-bold">Método</th>
                  <th className="py-2 font-bold">Referencia</th>
                  <th className="py-2 font-bold">Estado</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr
                    key={p.id}
                    className={`border-b-2 border-gray-200 last:border-0 ${p.estado === "anulada" ? "opacity-50" : ""}`}
                  >
                    <td className="py-2 text-gray-600">
                      {formatFecha(p.fecha)}
                    </td>
                    <td className="py-2 text-gray-600">
                      {p.moneda} {p.monto}
                    </td>
                    <td className="py-2 text-gray-600">
                      {METODO_PAGO_LABEL[p.metodo_pago as MetodoPago] ?? p.metodo_pago}
                    </td>
                    <td className="py-2 text-gray-600">{p.referencia ?? "—"}</td>
                    <td className="py-2">
                      <span
                        className={
                          p.estado === "anulada"
                            ? "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                            : "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                        }
                      >
                        {p.estado === "anulada" ? "Anulada" : "Activa"}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      {p.estado === "activa" && (
                        <ConfirmFormButton
                          action={anularPagoProveedor.bind(null, p.id, id)}
                          confirmMessage="¿Anular este pago?"
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
            <p className="mb-6 text-sm text-gray-400">Aún no hay pagos registrados.</p>
          )}

          {!anulada && saldo > 0 && (
            <form
              action={createPagoProveedor}
              className="grid grid-cols-1 items-end gap-3 border-t border-gray-100 pt-4 sm:grid-cols-[140px_140px_1fr_auto]"
            >
              <input type="hidden" name="compra_id" value={id} />
              <input type="hidden" name="moneda" value={compra.moneda} />
              <input type="hidden" name="tipo_cambio_aplicado" value={compra.tipo_cambio_aplicado} />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Monto
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={saldo.toFixed(2)}
                  name="monto"
                  required
                  defaultValue={saldo.toFixed(2)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Método
                </label>
                <select
                  name="metodo_pago"
                  defaultValue="efectivo"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m} value={m}>
                      {METODO_PAGO_LABEL[m]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Referencia
                </label>
                <input
                  name="referencia"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <SubmitButton icon={<Save size={16} />} pendingLabel="Registrando...">
                Registrar pago
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

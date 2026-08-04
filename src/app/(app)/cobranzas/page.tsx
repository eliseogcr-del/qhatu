import Link from "next/link";
import { XCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { METODO_PAGO_LABEL, TIPO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";
import ConfirmFormButton from "@/components/ConfirmFormButton";
import { anularCobranza } from "./actions";

export default async function CobranzasPage() {
  const supabase = await createClient();
  const { data: cobranzas, error } = await supabase
    .from("cobranzas")
    .select(
      "id, fecha, monto, moneda, metodo_pago, tipo_pago, referencia, estado, pedido_id, pedidos(clientes(nombre))",
    )
    .order("fecha", { ascending: false });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Cobranzas</h1>
          <Link
            href="/cobranzas/nueva"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Registrar cobro
          </Link>
        </div>

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
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Monto</th>
                <th className="px-4 py-3 font-medium">Método</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Referencia</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cobranzas?.map((cobranza) => {
                const cliente = (
                  cobranza.pedidos as unknown as { clientes: { nombre: string } | null } | null
                )?.clientes;
                return (
                  <tr
                    key={cobranza.id}
                    className={`border-b border-gray-100 last:border-0 ${cobranza.estado === "anulada" ? "opacity-50" : ""}`}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {cliente?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(cobranza.fecha).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cobranza.moneda} {cobranza.monto}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {METODO_PAGO_LABEL[cobranza.metodo_pago as MetodoPago] ??
                        cobranza.metodo_pago}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {TIPO_PAGO_LABEL[cobranza.tipo_pago] ?? cobranza.tipo_pago}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {cobranza.referencia ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          cobranza.estado === "anulada"
                            ? "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                            : "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                        }
                      >
                        {cobranza.estado === "anulada" ? "Anulada" : "Activa"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/pedidos/${cobranza.pedido_id}`}
                          className="text-sm font-medium text-gray-700 hover:underline"
                        >
                          Ver pedido
                        </Link>
                        {cobranza.estado === "activa" && (
                          <ConfirmFormButton
                            action={anularCobranza.bind(null, cobranza.id, "/cobranzas")}
                            confirmMessage="¿Anular este cobro? Quedará registrado en el log de auditoría."
                            icon={<XCircle size={14} />}
                            pendingLabel="Anulando..."
                            className="border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Anular
                          </ConfirmFormButton>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {cobranzas?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay cobranzas registradas.
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

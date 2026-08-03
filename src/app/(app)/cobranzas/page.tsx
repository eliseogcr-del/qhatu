import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { METODO_PAGO_LABEL, TIPO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";

export default async function CobranzasPage() {
  const supabase = await createClient();
  const { data: cobranzas, error } = await supabase
    .from("cobranzas")
    .select(
      "id, fecha, monto, moneda, metodo_pago, tipo_pago, referencia, pedido_id, pedidos(clientes(nombre))",
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
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {cobranzas?.map((cobranza) => {
                const cliente = (
                  cobranza.pedidos as unknown as { clientes: { nombre: string } | null } | null
                )?.clientes;
                return (
                  <tr key={cobranza.id} className="border-b border-gray-100 last:border-0">
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
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/pedidos/${cobranza.pedido_id}`}
                        className="text-sm font-medium text-gray-700 hover:underline"
                      >
                        Ver pedido
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {cobranzas?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
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

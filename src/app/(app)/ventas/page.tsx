import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function VentasPage() {
  const supabase = await createClient();
  const { data: ventas, error } = await supabase
    .from("ventas")
    .select("id, fecha, moneda, total, estado, clientes(nombre)")
    .order("fecha", { ascending: false });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Ventas</h1>
          <Link
            href="/ventas/nueva"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Registrar venta
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
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {ventas?.map((venta) => {
                const cliente = venta.clientes as unknown as { nombre: string } | null;
                return (
                  <tr key={venta.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {cliente?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(venta.fecha).toLocaleDateString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {venta.moneda} {venta.total}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        {venta.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/ventas/${venta.id}`}
                        className="text-sm font-medium text-gray-700 hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {ventas?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay ventas registradas.
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

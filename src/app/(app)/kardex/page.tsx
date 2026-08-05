import { createClient } from "@/utils/supabase/server";
import { TIPO_MOVIMIENTO_LABEL, type TipoMovimiento } from "@/lib/kardex-tipos";

export default async function KardexPage() {
  const supabase = await createClient();
  const { data: movimientos, error } = await supabase
    .from("kardex_movimientos")
    .select(
      "id, fecha, tipo_movimiento, cantidad, saldo_resultante, productos(nombre), almacenes(nombre), usuarios(nombre)",
    )
    .order("fecha", { ascending: false })
    .limit(200);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Kardex</h1>
        <p className="mb-4 text-sm text-gray-500">
          Registro inmutable de movimientos de stock (últimos 200).
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Almacén</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Saldo resultante</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
              </tr>
            </thead>
            <tbody>
              {movimientos?.map((m) => {
                const producto = m.productos as unknown as { nombre: string } | null;
                const almacen = m.almacenes as unknown as { nombre: string } | null;
                const usuario = m.usuarios as unknown as { nombre: string | null } | null;
                return (
                  <tr key={m.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(m.fecha).toLocaleString("es-PE")}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {producto?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{almacen?.nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {TIPO_MOVIMIENTO_LABEL[m.tipo_movimiento as TipoMovimiento] ??
                        m.tipo_movimiento}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${m.cantidad < 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.saldo_resultante}</td>
                    <td className="px-4 py-3 text-gray-600">{usuario?.nombre ?? "—"}</td>
                  </tr>
                );
              })}
              {movimientos?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay movimientos registrados.
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

import Link from "next/link";
import { createClient } from "@/utils/supabase/server";

export default async function InventarioPage() {
  const supabase = await createClient();
  const { data: inventario, error } = await supabase
    .from("inventario")
    .select(
      "id, stock_actual, productos(nombre, stock_minimo), almacenes(nombre)",
    )
    .order("id");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Inventario</h1>
          <div className="flex items-center gap-4">
            <Link
              href="/almacenes"
              className="text-sm font-medium text-gray-600 hover:underline"
            >
              Almacenes
            </Link>
            <Link
              href="/inventario/movimiento"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              + Registrar movimiento
            </Link>
          </div>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Almacén</th>
                <th className="px-4 py-3 font-medium">Stock actual</th>
                <th className="px-4 py-3 font-medium">Stock mínimo</th>
              </tr>
            </thead>
            <tbody>
              {inventario?.map((item) => {
                const producto = item.productos as unknown as {
                  nombre: string;
                  stock_minimo: number | null;
                } | null;
                const almacen = item.almacenes as unknown as { nombre: string } | null;
                const bajoMinimo =
                  producto?.stock_minimo != null &&
                  item.stock_actual <= producto.stock_minimo;
                return (
                  <tr key={item.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {producto?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{almacen?.nombre ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          bajoMinimo
                            ? "font-semibold text-red-600"
                            : "text-gray-900"
                        }
                      >
                        {item.stock_actual}
                      </span>
                      {bajoMinimo && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Bajo mínimo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {producto?.stock_minimo ?? "—"}
                    </td>
                  </tr>
                );
              })}
              {inventario?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay movimientos de inventario.
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

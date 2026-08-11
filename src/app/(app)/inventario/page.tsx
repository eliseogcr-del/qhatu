import Link from "next/link";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{
    producto_id?: string;
    almacen_id?: string;
    bajo_minimo?: string;
    sobre_maximo?: string;
  }>;
}) {
  const {
    producto_id: productoId,
    almacen_id: almacenId,
    bajo_minimo: bajoMinimoFiltro,
    sobre_maximo: sobreMaximoFiltro,
  } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("inventario")
    .select(
      "id, stock_actual, producto_id, productos(nombre, stock_minimo, stock_maximo), almacenes(nombre)",
    )
    .order("id");

  if (productoId) query = query.eq("producto_id", productoId);
  if (almacenId) query = query.eq("almacen_id", almacenId);

  const [{ data: inventarioCrudo, error }, { data: productos }, { data: almacenes }] =
    await Promise.all([
      query,
      supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("almacenes").select("id, nombre").eq("activo", true).order("nombre"),
    ]);

  const filasCalculadas = (inventarioCrudo ?? []).map((item) => {
    const producto = item.productos as unknown as {
      nombre: string;
      stock_minimo: number | null;
      stock_maximo: number | null;
    } | null;
    const almacen = item.almacenes as unknown as { nombre: string } | null;
    const bajoMinimo =
      producto?.stock_minimo != null && item.stock_actual <= producto.stock_minimo;
    const sobreMaximo =
      producto?.stock_maximo != null && item.stock_actual >= producto.stock_maximo;
    return { ...item, producto, almacen, bajoMinimo, sobreMaximo };
  });

  const inventario = filasCalculadas.filter((f) => {
    if (bajoMinimoFiltro === "1" && !f.bajoMinimo) return false;
    if (sobreMaximoFiltro === "1" && !f.sobreMaximo) return false;
    return true;
  });

  const hayFiltros = !!(
    productoId ||
    almacenId ||
    bajoMinimoFiltro === "1" ||
    sobreMaximoFiltro === "1"
  );

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

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Producto
            </label>
            <select
              name="producto_id"
              defaultValue={productoId ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {productos?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Almacén
            </label>
            <select
              name="almacen_id"
              defaultValue={almacenId ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {almacenes?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="bajo_minimo"
              value="1"
              defaultChecked={bajoMinimoFiltro === "1"}
              className="h-4 w-4 rounded border-gray-300"
            />
            Bajo mínimo
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="sobre_maximo"
              value="1"
              defaultChecked={sobreMaximoFiltro === "1"}
              className="h-4 w-4 rounded border-gray-300"
            />
            Sobre máximo
          </label>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/inventario"
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Limpiar
            </Link>
          )}
        </form>

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
                <th className="px-4 py-3 font-medium">Stock máximo</th>
              </tr>
            </thead>
            <tbody>
              {inventario.map((item) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {item.producto?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{item.almacen?.nombre ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        item.bajoMinimo
                          ? "font-semibold text-red-600"
                          : item.sobreMaximo
                            ? "font-semibold text-blue-900"
                            : "text-gray-900"
                      }
                    >
                      {item.stock_actual}
                    </span>
                    {item.bajoMinimo && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Bajo mínimo
                      </span>
                    )}
                    {item.sobreMaximo && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900">
                        Sobre máximo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.producto?.stock_minimo ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.producto?.stock_maximo ?? "—"}
                  </td>
                </tr>
              ))}
              {inventario.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ningún registro coincide con los filtros."
                      : "Aún no hay movimientos de inventario."}
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

import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { toggleActivoProducto } from "./actions";

export default async function ProductosPage() {
  const supabase = await createClient();
  const { data: productos, error } = await supabase
    .from("productos")
    .select(
      "id, nombre, marca, grupo, precio_venta, precio_venta_moneda, control_inventario, activo",
    )
    .order("nombre");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Productos</h1>
          <Link
            href="/productos/nuevo"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            + Nuevo producto
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Marca</th>
                <th className="px-4 py-3 font-medium">Grupo</th>
                <th className="px-4 py-3 font-medium">Precio</th>
                <th className="px-4 py-3 font-medium">Inventario</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {productos?.map((producto) => (
                <tr
                  key={producto.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {producto.nombre}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {producto.marca ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {producto.grupo ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {producto.precio_venta_moneda} {producto.precio_venta}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {producto.control_inventario ? "Sí" : "No"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        producto.activo
                          ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                          : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500"
                      }
                    >
                      {producto.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="space-x-3 px-4 py-3 text-right">
                    <Link
                      href={`/productos/${producto.id}/editar`}
                      className="text-sm font-medium text-gray-700 hover:underline"
                    >
                      Editar
                    </Link>
                    <form
                      action={toggleActivoProducto.bind(
                        null,
                        producto.id,
                        !producto.activo,
                      )}
                      className="inline"
                    >
                      <button
                        type="submit"
                        className="text-sm font-medium text-gray-500 hover:underline"
                      >
                        {producto.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}

              {productos?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay productos registrados.
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

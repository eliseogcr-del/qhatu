import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { toggleActivoProveedor } from "./actions";

export default async function ProveedoresPage() {
  const supabase = await createClient();
  const { data: proveedores, error } = await supabase
    .from("proveedores")
    .select("id, nombre, ruc, contacto, telefono, activo")
    .order("nombre");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Proveedores</h1>
          <Link
            href="/proveedores/nuevo"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            + Nuevo proveedor
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
                <th className="px-4 py-3 font-medium">RUC</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {proveedores?.map((proveedor) => (
                <tr
                  key={proveedor.id}
                  className="border-b border-gray-100 last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {proveedor.nombre}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {proveedor.ruc ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {proveedor.contacto ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {proveedor.telefono ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        proveedor.activo
                          ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                          : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500"
                      }
                    >
                      {proveedor.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="space-x-3 px-4 py-3 text-right">
                    <Link
                      href={`/proveedores/${proveedor.id}/editar`}
                      className="text-sm font-medium text-gray-700 hover:underline"
                    >
                      Editar
                    </Link>
                    <form
                      action={toggleActivoProveedor.bind(
                        null,
                        proveedor.id,
                        !proveedor.activo,
                      )}
                      className="inline"
                    >
                      <button
                        type="submit"
                        className="text-sm font-medium text-gray-500 hover:underline"
                      >
                        {proveedor.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}

              {proveedores?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay proveedores registrados.
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

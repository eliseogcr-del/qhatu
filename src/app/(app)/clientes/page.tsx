import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { toggleActivo } from "./actions";

export default async function ClientesPage() {
  const supabase = await createClient();
  const { data: clientes, error } = await supabase
    .from("clientes")
    .select(
      "id, tipo_documento, numero_documento, nombre, telefono, distrito, zona, activo",
    )
    .order("nombre");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>
          <Link
            href="/clientes/nuevo"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Nuevo cliente
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
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Nombre / Razón social</th>
                <th className="px-4 py-3 font-medium">Teléfono</th>
                <th className="px-4 py-3 font-medium">Distrito</th>
                <th className="px-4 py-3 font-medium">Zona</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {clientes?.map((cliente) => (
                <tr key={cliente.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-gray-600">
                    {cliente.tipo_documento} {cliente.numero_documento}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {cliente.nombre}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {cliente.telefono ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {cliente.distrito ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{cliente.zona ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        cliente.activo
                          ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                          : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500"
                      }
                    >
                      {cliente.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="space-x-3 px-4 py-3 text-right">
                    <Link
                      href={`/clientes/${cliente.id}/editar`}
                      className="text-sm font-medium text-gray-700 hover:underline"
                    >
                      Editar
                    </Link>
                    <form
                      action={toggleActivo.bind(null, cliente.id, !cliente.activo)}
                      className="inline"
                    >
                      <button
                        type="submit"
                        className="text-sm font-medium text-gray-500 hover:underline"
                      >
                        {cliente.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}

              {clientes?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay clientes registrados.
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

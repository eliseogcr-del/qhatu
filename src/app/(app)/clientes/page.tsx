import Link from "next/link";
import { Plus, FileDown, Search, Pencil, Power, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { toggleActivo } from "./actions";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("clientes")
    .select(
      "id, tipo_documento, numero_documento, nombre, telefono, distrito, zona, activo",
    )
    .order("nombre");

  if (q) query = query.ilike("nombre", `%${q}%`);

  const { data: clientes, error } = await query;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>
          <div className="flex items-center gap-3">
            <a
              href={`/clientes/export${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={16} />
              Exportar a Excel
            </a>
            <Link
              href="/clientes/nuevo"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus size={16} />
              Nuevo cliente
            </Link>
          </div>
        </div>

        <form className="mb-4 flex items-center gap-2" method="get">
          <div className="relative flex-1 max-w-sm">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Buscar por nombre..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Buscar
          </button>
          {q && (
            <Link
              href="/clientes"
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
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/clientes/${cliente.id}/editar`}
                        className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:underline"
                      >
                        <Pencil size={14} />
                        Editar
                      </Link>
                      <form
                        action={toggleActivo.bind(null, cliente.id, !cliente.activo)}
                      >
                        <button
                          type="submit"
                          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
                        >
                          <Power size={14} />
                          {cliente.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}

              {clientes?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    {q
                      ? `Ningún cliente coincide con "${q}".`
                      : "Aún no hay clientes registrados."}
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

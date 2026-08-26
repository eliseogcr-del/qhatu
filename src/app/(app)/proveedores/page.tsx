import Link from "next/link";
import { Plus, FileDown, Pencil, Power } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { toggleActivoProveedor } from "./actions";
import ProveedoresFiltroForm from "@/components/ProveedoresFiltroForm";

export default async function ProveedoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("proveedores")
    .select("id, nombre, ruc, contacto, telefono, activo")
    .order("nombre");

  if (q) query = query.ilike("nombre", `%${q}%`);

  const { data: proveedores, error } = await query;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Proveedores</h1>
          <div className="flex items-center gap-3">
            <a
              href={`/proveedores/export${q ? `?q=${encodeURIComponent(q)}` : ""}`}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={16} />
              Exportar a Excel
            </a>
            <Link
              href="/proveedores/nuevo"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus size={16} />
              Nuevo proveedor
            </Link>
          </div>
        </div>

        <ProveedoresFiltroForm q={q ?? ""} />

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Nombre</th>
                <th className="px-4 py-3 font-bold">RUC</th>
                <th className="px-4 py-3 font-bold">Contacto</th>
                <th className="px-4 py-3 font-bold">Teléfono</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {proveedores?.map((proveedor) => (
                <tr
                  key={proveedor.id}
                  className="border-b-2 border-gray-200 last:border-0"
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
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/proveedores/${proveedor.id}/editar`}
                        className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:underline"
                      >
                        <Pencil size={14} />
                        Editar
                      </Link>
                      <form
                        action={toggleActivoProveedor.bind(
                          null,
                          proveedor.id,
                          !proveedor.activo,
                        )}
                      >
                        <button
                          type="submit"
                          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
                        >
                          <Power size={14} />
                          {proveedor.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}

              {proveedores?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    {q
                      ? `Ningún proveedor coincide con "${q}".`
                      : "Aún no hay proveedores registrados."}
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

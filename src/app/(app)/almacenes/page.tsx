import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import { createAlmacen, toggleActivoAlmacen } from "./actions";

export default async function AlmacenesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  await requireAdmin(supabase);
  const { data: almacenes } = await supabase
    .from("almacenes")
    .select("id, nombre, direccion, activo, es_digital")
    .order("nombre");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Almacenes</h1>
        <p className="-mt-4 text-sm text-gray-500">
          Cada almacén representa un local físico. Asigna a cada usuario a uno
          desde Usuarios para que sus pedidos, ventas y compras queden
          separados por local.
        </p>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Nuevo almacén
          </h2>
          <form action={createAlmacen} className="space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <input
                name="nombre"
                placeholder="Nombre"
                required
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                name="direccion"
                placeholder="Dirección (opcional)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                Crear
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="es_digital"
                className="h-4 w-4 rounded border-gray-300"
              />
              Es almacén digital (usa Precio Digital en vez de Precio Campo)
            </label>
          </form>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Nombre</th>
                <th className="px-4 py-3 font-bold">Dirección</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {almacenes?.map((a) => (
                <tr key={a.id} className="border-b-2 border-gray-200 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.nombre}
                    {a.es_digital && (
                      <span className="ml-2 rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                        Digital
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.direccion ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        a.activo
                          ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                          : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500"
                      }
                    >
                      {a.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/almacenes/${a.id}/editar`}
                        className="text-sm font-medium text-gray-500 hover:underline"
                      >
                        Editar
                      </Link>
                      <form action={toggleActivoAlmacen.bind(null, a.id, !a.activo)}>
                        <button
                          type="submit"
                          className="text-sm font-medium text-gray-500 hover:underline"
                        >
                          {a.activo ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {almacenes?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay almacenes.
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

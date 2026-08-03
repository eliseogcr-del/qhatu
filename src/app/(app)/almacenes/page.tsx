import { createClient } from "@/utils/supabase/server";
import { createAlmacen, toggleActivoAlmacen } from "./actions";

export default async function AlmacenesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: almacenes } = await supabase
    .from("almacenes")
    .select("id, nombre, direccion, activo")
    .order("nombre");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Almacenes</h1>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Nuevo almacén
          </h2>
          <form action={createAlmacen} className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <input
              name="nombre"
              placeholder="Nombre"
              required
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              name="direccion"
              placeholder="Dirección (opcional)"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Crear
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Dirección</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {almacenes?.map((a) => (
                <tr key={a.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.nombre}</td>
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
                    <form action={toggleActivoAlmacen.bind(null, a.id, !a.activo)}>
                      <button
                        type="submit"
                        className="text-sm font-medium text-gray-500 hover:underline"
                      >
                        {a.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
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

import { Scale } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import SubmitButton from "@/components/SubmitButton";
import FiltroTexto from "@/components/FiltroTexto";
import { actualizarUnidadVentaPreferida } from "./actions";

export default async function UnidadesVentaPreferidasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string; q?: string }>;
}) {
  const { error, guardado, q } = await searchParams;
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  let productosQuery = supabase
    .from("productos")
    .select("id, nombre, unidad_medida_id, unidad_venta_defecto_id, unidades_medida(descripcion)")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("nombre");
  if (q) productosQuery = productosQuery.ilike("nombre", `%${q}%`);

  const [{ data: productos }, { data: unidadesMedida }] = await Promise.all([
    productosQuery,
    supabase
      .from("unidades_medida")
      .select("id, descripcion")
      .eq("activo", true)
      .order("descripcion"),
  ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Scale size={24} className="text-emerald-700" />
          <h1 className="text-2xl font-semibold text-gray-900">
            Unidades preferidas de venta
          </h1>
        </div>
        <p className="-mt-2 text-sm text-gray-500">
          Solo para agilizar el ingreso: define qué unidad se preselecciona
          al agregar cada producto en Pedidos, Ventas y Cotizaciones. No
          cambia la unidad base del producto (Productos → Editar) ni afecta
          el precio ni el inventario — en cada línea se puede igual elegir
          otra unidad a mano.
        </p>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {guardado && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Guardado.
          </p>
        )}

        <FiltroTexto q={q ?? ""} label="Filtrar por producto" placeholder="Buscar por producto..." />

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Producto</th>
                <th className="px-4 py-3 font-bold">Unidad de medida (base)</th>
                <th className="px-4 py-3 font-bold">Unidad preferida de venta</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {productos?.map((producto) => {
                const unidadBase = producto.unidades_medida as unknown as {
                  descripcion: string;
                } | null;
                return (
                  <tr key={producto.id} className="border-b-2 border-gray-200 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">{producto.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{unidadBase?.descripcion ?? "—"}</td>
                    <td className="px-4 py-3" colSpan={2}>
                      <form
                        action={actualizarUnidadVentaPreferida.bind(null, producto.id)}
                        className="flex items-center gap-2"
                      >
                        <input type="hidden" name="_q" value={q ?? ""} />
                        <select
                          name="unidad_venta_defecto_id"
                          defaultValue={producto.unidad_venta_defecto_id ?? ""}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
                        >
                          <option value="">
                            Usar la unidad de medida ({unidadBase?.descripcion ?? "—"})
                          </option>
                          {unidadesMedida?.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.descripcion}
                            </option>
                          ))}
                        </select>
                        <SubmitButton
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Guardar
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
              {productos?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                    {q
                      ? `Ningún producto coincide con "${q}".`
                      : "No hay productos activos."}
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

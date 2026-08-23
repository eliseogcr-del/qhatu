import Link from "next/link";
import { Plus, Pencil, Power } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import ConfirmFormButton from "@/components/ConfirmFormButton";
import { toggleActivoUnidadMedida } from "./actions";

export default async function UnidadesMedidaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const { data: unidades } = await supabase
    .from("unidades_medida")
    .select("id, codigo, descripcion, cantidad, activo")
    .eq("empresa_id", empresaId)
    .order("descripcion");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Unidades de medida</h1>
          <Link
            href="/unidades-medida/nuevo"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={16} />
            Nueva unidad
          </Link>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Con cuántas unidades sueltas equivale cada presentación (ej. DOCENA
          = 12) — se usa en Productos, Pedidos y Ventas para convertir a
          unidades base al descontar el stock.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Código</th>
                <th className="px-4 py-3 font-bold">Descripción</th>
                <th className="px-4 py-3 font-bold">Cantidad</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {unidades?.map((u) => (
                <tr key={u.id} className="border-b-2 border-gray-200 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{u.codigo}</td>
                  <td className="px-4 py-3 text-gray-600">{u.descripcion}</td>
                  <td className="px-4 py-3 text-gray-600">{u.cantidad}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.activo
                          ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                          : "rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500"
                      }
                    >
                      {u.activo ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/unidades-medida/${u.id}/editar`}
                        className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:underline"
                      >
                        <Pencil size={14} />
                        Editar
                      </Link>
                      <ConfirmFormButton
                        action={toggleActivoUnidadMedida.bind(null, u.id, !u.activo)}
                        confirmMessage={
                          u.activo
                            ? "¿Desactivar esta unidad de medida?"
                            : "¿Activar esta unidad de medida?"
                        }
                        icon={<Power size={14} />}
                        pendingLabel="Guardando..."
                        className="border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </ConfirmFormButton>
                    </div>
                  </td>
                </tr>
              ))}
              {unidades?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay unidades de medida registradas.
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

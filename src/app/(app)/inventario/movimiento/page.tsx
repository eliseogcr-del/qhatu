import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { registrarMovimientoManual } from "../actions";
import { TIPOS_MOVIMIENTO_MANUAL, TIPO_MOVIMIENTO_LABEL } from "@/lib/kardex-tipos";
import ProductoCombobox from "@/components/ProductoCombobox";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

export default async function MovimientoInventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { empresaId, almacenId } = await getEmpresaSession(supabase);

  const [{ data: productos }, { data: almacenes }] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre")
      .eq("activo", true)
      .eq("control_inventario", true)
      .order("nombre"),
    (() => {
      let query = supabase
        .from("almacenes")
        .select("id, nombre")
        .eq("empresa_id", empresaId)
        .eq("activo", true);
      if (almacenId) query = query.eq("id", almacenId);
      return query.order("nombre");
    })(),
  ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Registrar movimiento
          </h1>
          <Link
            href="/inventario"
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver al inventario
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <form action={registrarMovimientoManual} className="space-y-4">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Producto
              </label>
              <ProductoCombobox
                productos={productos ?? []}
                name="producto_id"
                className={inputClass}
              />
              {productos?.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  Ningún producto activo lleva control de inventario.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Almacén
              </label>
              <select name="almacen_id" required className={inputClass}>
                <option value="">Selecciona un almacén</option>
                {almacenes?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Tipo
                </label>
                <select name="tipo_movimiento" defaultValue="ajuste" className={inputClass}>
                  {TIPOS_MOVIMIENTO_MANUAL.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_MOVIMIENTO_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Dirección
                </label>
                <select name="direccion" defaultValue="entrada" className={inputClass}>
                  <option value="entrada">Entrada (suma stock)</option>
                  <option value="salida">Salida (resta stock)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Cantidad
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="cantidad"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Registrar movimiento
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

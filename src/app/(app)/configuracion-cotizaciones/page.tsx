import { FileSpreadsheet, Save } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import SubmitButton from "@/components/SubmitButton";
import { guardarConfiguracionCotizaciones } from "./actions";

export default async function ConfiguracionCotizacionesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { error, guardado } = await searchParams;
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const { data: config } = await supabase
    .from("configuracion_cotizaciones")
    .select("numero_inicial, porcentaje_igv")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <FileSpreadsheet size={24} className="text-emerald-700" />
          <h1 className="text-2xl font-semibold text-gray-900">Cotizaciones</h1>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          El número inicial define desde qué correlativo empiezan las
          cotizaciones (si ya hay cotizaciones registradas, el sistema nunca
          repite un número ya usado). El porcentaje de impuesto es propio de
          la cotización — no afecta el IGV de 18% que usan Nota de
          venta/Factura/Boleta.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {guardado && (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Configuración guardada.
          </p>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <form action={guardarConfiguracionCotizaciones} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Número inicial de cotización
                </label>
                <input
                  type="number"
                  min="1"
                  name="numero_inicial"
                  required
                  defaultValue={config?.numero_inicial ?? 1}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Porcentaje de impuesto (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="porcentaje_igv"
                  required
                  defaultValue={config?.porcentaje_igv ?? 10.5}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <SubmitButton icon={<Save size={16} />}>Guardar</SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}

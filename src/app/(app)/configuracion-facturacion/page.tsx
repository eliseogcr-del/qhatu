import { Settings, Save } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import SubmitButton from "@/components/SubmitButton";
import { guardarConfiguracionFacturacion } from "./actions";

export default async function ConfiguracionFacturacionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { error, guardado } = await searchParams;
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const { data: config } = await supabase
    .from("configuracion_facturacion")
    .select("serie_factura, serie_boleta")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <Settings size={24} className="text-emerald-700" />
          <h1 className="text-2xl font-semibold text-gray-900">Facturación electrónica</h1>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Series asignadas por Nubefact a tu cuenta — las notas de crédito y
          débito de cada tipo de comprobante usan la misma serie que su
          documento original, así que solo hace falta configurar estas dos.
          Cuando pases de la cuenta demo a producción, solo tienes que
          actualizar estos valores acá.
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
          <form action={guardarConfiguracionFacturacion} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Serie para Factura
                </label>
                <input
                  name="serie_factura"
                  required
                  defaultValue={config?.serie_factura ?? "FFF1"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Serie para Boleta
                </label>
                <input
                  name="serie_boleta"
                  required
                  defaultValue={config?.serie_boleta ?? "BBB1"}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-emerald-500 focus:outline-none"
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

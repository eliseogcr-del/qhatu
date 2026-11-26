import Link from "next/link";
import { ArrowLeft, UploadCloud } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireConciliacionCobranzas } from "@/utils/supabase/session";
import { hoyLima } from "@/lib/fecha";

export default async function ConciliacionCobranzasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; fecha?: string }>;
}) {
  const { error, fecha } = await searchParams;
  const supabase = await createClient();
  await requireConciliacionCobranzas(supabase);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Conciliar pagos digitales</h1>
          <Link href="/cobranzas" className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline">
            <ArrowLeft size={16} />
            Volver a Cobranzas
          </Link>
        </div>

        <p className="mb-6 text-sm text-gray-500">
          Sube el reporte de movimientos que descargas de Yape/Plin/banco (tal cual, sin
          arreglarlo a mano) para un día en particular, y cruza cada monto contra lo cobrado ese
          mismo día en el sistema con esos métodos de pago (Yape, Plin, Transferencia). Descarga un
          Excel con el resultado: qué calzó, qué cobro del sistema no aparece en el archivo, y qué
          movimiento del archivo no aparece en el sistema. No modifica ningún cobro — es solo un
          reporte.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <form
          action="/cobranzas/conciliacion/procesar"
          method="POST"
          encType="multipart/form-data"
          className="space-y-6 rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fecha a conciliar</label>
            <input
              type="date"
              name="fecha"
              required
              defaultValue={fecha ?? hoyLima()}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Archivo(s) del banco/Yape/Plin
            </label>
            <input
              type="file"
              name="archivos"
              accept=".xlsx,.xls"
              multiple
              required
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
            />
            <p className="mt-1 text-xs text-gray-500">
              Puedes seleccionar varios a la vez (ej. el de Yape y el de Plin del mismo día).
            </p>
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <UploadCloud size={16} />
            Cruzar y descargar resultado
          </button>
        </form>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireComercial } from "@/utils/supabase/session";
import { hoyLima } from "@/lib/fecha";
import CotizacionForm from "@/components/CotizacionForm";
import { createCotizacion } from "../actions";

export default async function NuevaCotizacionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { empresaId } = await requireComercial(supabase);

  const [{ data: clientes }, { data: productos }, { data: unidadesMedida }, { data: config }] =
    await Promise.all([
      supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("productos")
        .select("id, nombre, precio_venta, precio_venta_moneda, unidad_medida_id")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("unidades_medida")
        .select("id, descripcion, cantidad")
        .eq("activo", true)
        .order("descripcion"),
      supabase
        .from("configuracion_cotizaciones")
        .select("porcentaje_igv")
        .eq("empresa_id", empresaId)
        .maybeSingle(),
    ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Nueva cotización</h1>
          <Link
            href="/cotizaciones"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <CotizacionForm
            action={createCotizacion}
            error={error}
            clientes={clientes ?? []}
            productos={productos ?? []}
            unidadesMedida={unidadesMedida ?? []}
            porcentajeIgv={config?.porcentaje_igv ?? 10.5}
            hoy={hoyLima()}
          />
        </div>
      </div>
    </div>
  );
}

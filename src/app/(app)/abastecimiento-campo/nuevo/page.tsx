import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import AbastecimientoCampoForm from "@/components/AbastecimientoCampoForm";
import { createAbastecimientoCampo } from "../actions";

export default async function NuevoAbastecimientoCampoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { empresaId, almacenId } = await getEmpresaSession(supabase);

  const [{ data: proveedores }, { data: productos }, { data: almacenes }, { data: unidadesMedida }] =
    await Promise.all([
      supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("productos")
        .select("id, nombre, unidad_medida_id")
        .eq("activo", true)
        .eq("control_inventario", true)
        .order("nombre"),
      almacenId
        ? Promise.resolve({ data: null })
        : supabase
            .from("almacenes")
            .select("id, nombre")
            .eq("empresa_id", empresaId)
            .eq("activo", true)
            .order("nombre"),
      supabase
        .from("unidades_medida")
        .select("id, descripcion, cantidad")
        .eq("activo", true)
        .order("descripcion"),
    ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Nuevo abastecimiento en campo</h1>
          <Link
            href="/abastecimiento-campo"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Para cuando un vendedor recoge mercadería de un proveedor
          directamente en ruta, sin documento de compra — solo registra qué
          y cuánto, y suma de inmediato a su almacén.
        </p>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <AbastecimientoCampoForm
            action={createAbastecimientoCampo}
            error={error}
            proveedores={proveedores ?? []}
            productos={productos ?? []}
            unidadesMedida={unidadesMedida ?? []}
            almacenes={almacenes ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}

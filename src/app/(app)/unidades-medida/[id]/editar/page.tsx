import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import UnidadMedidaForm from "@/components/UnidadMedidaForm";
import { updateUnidadMedida } from "../../actions";

export default async function EditarUnidadMedidaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { data: unidad } = await supabase
    .from("unidades_medida")
    .select("id, codigo, descripcion, cantidad, activo")
    .eq("id", id)
    .single();

  if (!unidad) notFound();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Editar unidad de medida</h1>
          <Link
            href="/unidades-medida"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <UnidadMedidaForm
            action={updateUnidadMedida.bind(null, id)}
            error={error}
            initialValues={{
              codigo: unidad.codigo,
              descripcion: unidad.descripcion,
              cantidad: unidad.cantidad,
              activo: unidad.activo,
            }}
            submitLabel="Guardar cambios"
          />
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import UnidadMedidaForm from "@/components/UnidadMedidaForm";
import { createUnidadMedida } from "../actions";

export default async function NuevaUnidadMedidaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  await requireAdmin(supabase);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Nueva unidad de medida</h1>
          <Link
            href="/unidades-medida"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <UnidadMedidaForm
            action={createUnidadMedida}
            error={error}
            submitLabel="Crear unidad"
          />
        </div>
      </div>
    </div>
  );
}

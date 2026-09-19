import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireProduccionOAdmin } from "@/utils/supabase/session";
import ProduccionForm from "@/components/ProduccionForm";
import { createProduccion } from "../actions";

export default async function NuevaProduccionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { empresaId, almacenId } = await requireProduccionOAdmin(supabase);

  const [{ data: almacenes }, { data: productos }] = await Promise.all([
    // Un usuario con almacén fijo (rol "producción") no elige: el
    // servidor lo asigna solo (ver createProduccion/resolverAlmacenId).
    almacenId
      ? Promise.resolve({ data: null })
      : supabase
          .from("almacenes")
          .select("id, nombre")
          .eq("empresa_id", empresaId)
          .eq("activo", true)
          .order("nombre"),
    supabase
      .from("productos")
      .select("id, nombre")
      .eq("activo", true)
      .eq("control_inventario", true)
      .order("nombre"),
  ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Nueva producción</h1>
          <Link
            href="/produccion"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Registra los productos que se elaboraron hoy en el almacén — suma
          de inmediato al inventario y genera su movimiento de kardex.
        </p>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <ProduccionForm
            action={createProduccion}
            error={error}
            almacenes={almacenes ?? undefined}
            productos={productos ?? []}
          />
        </div>
      </div>
    </div>
  );
}

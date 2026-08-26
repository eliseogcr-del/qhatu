import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import MermaForm from "@/components/MermaForm";
import { registrarMermaDirecta } from "../actions";

export default async function NuevaMermaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);

  const [{ data: productos }, { data: almacenes }] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre")
      .eq("activo", true)
      .eq("control_inventario", true)
      .order("nombre"),
    session.almacenId
      ? Promise.resolve({ data: null })
      : supabase
          .from("almacenes")
          .select("id, nombre")
          .eq("empresa_id", session.empresaId)
          .eq("activo", true)
          .order("nombre"),
  ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Registrar merma</h1>
          <Link
            href="/kardex"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al kardex
          </Link>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Para productos que se malograron, vencieron o dañaron fuera de una
          venta — descuenta el stock de inmediato y queda en el kardex con la
          fecha, el usuario y la causa.
        </p>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <MermaForm
            action={registrarMermaDirecta}
            error={error}
            productos={productos ?? []}
            almacenes={almacenes ?? undefined}
          />
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import UsuarioForm from "@/components/UsuarioForm";
import { createUsuario } from "../actions";

export default async function NuevoUsuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);
  const { data: almacenes } = await supabase
    .from("almacenes")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("nombre");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Nuevo usuario</h1>
          <Link
            href="/usuarios"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <UsuarioForm
            action={createUsuario}
            error={error}
            modo="nuevo"
            submitLabel="Crear usuario"
            almacenes={almacenes ?? []}
          />
        </div>
      </div>
    </div>
  );
}

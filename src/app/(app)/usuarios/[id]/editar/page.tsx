import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import { createAdminClient } from "@/utils/supabase/admin";
import UsuarioForm from "@/components/UsuarioForm";
import { updateUsuario } from "../../actions";

export default async function EditarUsuarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const [{ data: usuario }, { data: almacenes }] = await Promise.all([
    supabase
      .from("usuarios")
      .select("id, username, nombre, rol, activo, almacen_id")
      .eq("id", id)
      .single(),
    supabase
      .from("almacenes")
      .select("id, nombre")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .order("nombre"),
  ]);

  if (!usuario) notFound();

  const admin = createAdminClient();
  const { data: authUser } = await admin.auth.admin.getUserById(id);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Editar usuario</h1>
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
            action={updateUsuario.bind(null, id)}
            error={error}
            modo="editar"
            initialValues={{
              username: usuario.username ?? "",
              nombre: usuario.nombre ?? "",
              rol: usuario.rol,
              activo: usuario.activo,
              almacenId: usuario.almacen_id,
            }}
            correoActual={authUser?.user?.email ?? ""}
            submitLabel="Guardar cambios"
            almacenes={almacenes ?? []}
          />
        </div>
      </div>
    </div>
  );
}

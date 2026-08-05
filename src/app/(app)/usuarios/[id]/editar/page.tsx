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
  await requireAdmin(supabase);

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, activo")
    .eq("id", id)
    .single();

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
              nombre: usuario.nombre ?? "",
              rol: usuario.rol,
              activo: usuario.activo,
            }}
            correoActual={authUser?.user?.email ?? ""}
            submitLabel="Guardar cambios"
          />
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Plus, Pencil, Power, ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import { createAdminClient } from "@/utils/supabase/admin";
import ConfirmFormButton from "@/components/ConfirmFormButton";
import { toggleActivoUsuario } from "./actions";

export default async function UsuariosPage() {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const { data: usuarios, error } = await supabase
    .from("usuarios")
    .select("id, nombre, rol, activo")
    .eq("empresa_id", empresaId)
    .order("nombre");

  const admin = createAdminClient();
  const { data: authList } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const correoPorId = new Map(authList?.users.map((u) => [u.id, u.email ?? "—"]));

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Usuarios</h1>
          <Link
            href="/usuarios/nuevo"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={16} />
            Nuevo usuario
          </Link>
        </div>

        <p className="mb-6 flex items-center gap-1.5 text-sm text-gray-500">
          <ShieldCheck size={14} />
          Solo administradores pueden crear o gestionar usuarios.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Correo</th>
                <th className="px-4 py-3 font-medium">Perfil</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {usuarios?.map((u) => (
                <tr key={u.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {u.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {correoPorId.get(u.id) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {u.rol === "admin" ? "Administrador" : "Vendedor"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        u.activo
                          ? "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
                          : "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                      }
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/usuarios/${u.id}/editar`}
                        className="flex items-center gap-1 text-sm font-medium text-gray-700 hover:underline"
                      >
                        <Pencil size={14} />
                        Editar
                      </Link>
                      <ConfirmFormButton
                        action={toggleActivoUsuario.bind(null, u.id, !u.activo)}
                        confirmMessage={
                          u.activo
                            ? "¿Desactivar este usuario? No podrá acceder al sistema."
                            : "¿Activar este usuario?"
                        }
                        icon={<Power size={14} />}
                        pendingLabel="Guardando..."
                        className="border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </ConfirmFormButton>
                    </div>
                  </td>
                </tr>
              ))}

              {usuarios?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

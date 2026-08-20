import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function getEmpresaSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("empresa_id, rol, almacen_id")
    .eq("id", user.id)
    .single();

  if (error || !usuario) {
    throw new Error(
      "Tu usuario no tiene un perfil de empresa asociado. Contacta al administrador.",
    );
  }

  return {
    userId: user.id,
    empresaId: usuario.empresa_id as string,
    rol: usuario.rol as string,
    // null = admin (ve/opera en todos los almacenes); para un vendedor
    // siempre viene fijo por el administrador desde Usuarios.
    almacenId: usuario.almacen_id as string | null,
  };
}

// Resuelve a qué almacén pertenece el movimiento que se está registrando:
// si el usuario tiene un almacén fijo (vendedor) se usa ese, ignorando
// cualquier valor del formulario; si no lo tiene (admin, ve todos), se
// toma del selector que el formulario debe incluir en ese caso.
export function resolverAlmacenId(
  session: { almacenId: string | null },
  formData: FormData,
): string | null {
  if (session.almacenId) return session.almacenId;
  const value = formData.get("almacen_id");
  return value ? String(value) : null;
}

// Bloquea el acceso a secciones sensibles (ej. auditoría) a quien no
// tenga rol de administrador.
export async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const session = await getEmpresaSession(supabase);
  if (session.rol !== "admin") {
    redirect(
      `/dashboard?error=${encodeURIComponent("No tienes permisos para acceder a esta sección.")}`,
    );
  }
  return session;
}

// Bloquea el acceso a secciones de logística (ej. Producción) a quien no
// sea administrador ni logística.
export async function requireLogisticaOAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const session = await getEmpresaSession(supabase);
  if (session.rol !== "admin" && session.rol !== "logistica") {
    redirect(
      `/dashboard?error=${encodeURIComponent("No tienes permisos para acceder a esta sección.")}`,
    );
  }
  return session;
}

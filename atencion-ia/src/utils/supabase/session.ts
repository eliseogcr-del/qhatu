import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function getTenantSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("tenant_id, nombre, rol")
    .eq("id", user.id)
    .single();

  if (error || !usuario) {
    throw new Error(
      "Tu usuario no tiene un tenant asociado. Contacta al administrador.",
    );
  }

  return {
    userId: user.id,
    tenantId: usuario.tenant_id as string,
    nombre: usuario.nombre as string | null,
    rol: usuario.rol as string,
  };
}

export async function requireAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const session = await getTenantSession(supabase);
  if (session.rol !== "admin") {
    redirect(
      `/dashboard?error=${encodeURIComponent("No tienes permisos para acceder a esta sección.")}`,
    );
  }
  return session;
}

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";

// auth.getUser() hace una llamada de red real a Supabase (revalida el JWT
// contra el servidor de Auth, no solo lo decodifica localmente) — sin
// cachear esto, el layout compartido de la app y cada página lo repetían
// por separado en cada navegación (2 o 3 veces por click), sumando esa
// latencia de red cada vez. React cache() deduplica esta llamada dentro de
// un mismo request sin importar cuántas funciones distintas la invoquen ni
// qué instancia de cliente supabase tenga cada una — por eso crea la suya
// propia acá en vez de recibirla por parámetro.
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function getEmpresaSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const user = await getAuthUser();

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

// Cotizaciones: visible para admin, logística y vendedor — el repartidor
// no cotiza ni ve el módulo comercial.
export async function requireComercial(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const session = await getEmpresaSession(supabase);
  if (!["admin", "logistica", "vendedor"].includes(session.rol)) {
    redirect(
      `/dashboard?error=${encodeURIComponent("No tienes permisos para acceder a esta sección.")}`,
    );
  }
  return session;
}

// Producción: además de admin/logística (que pueden registrar producción
// para cualquier almacén), el rol "producción" también entra pero queda
// amarrado a su propio almacén fijo (ver requiereAlmacen/resolverAlmacenId)
// — a diferencia de requireLogisticaOAdmin, que gate-a Compras y
// Promociones, secciones fuera del alcance de este rol.
export async function requireProduccionOAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const session = await getEmpresaSession(supabase);
  if (!["admin", "logistica", "produccion"].includes(session.rol)) {
    redirect(
      `/dashboard?error=${encodeURIComponent("No tienes permisos para acceder a esta sección.")}`,
    );
  }
  return session;
}

// Comprobantes: además de admin/logística, el rol "contador" también
// entra — es el único módulo al que tiene acceso (ver PRODUCCION_PERMITIDO
// equivalente en middleware.ts para el bloqueo de navegación al resto).
export async function requireComprobantesAcceso(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const session = await getEmpresaSession(supabase);
  if (!["admin", "logistica", "contador"].includes(session.rol)) {
    redirect(
      `/dashboard?error=${encodeURIComponent("No tienes permisos para acceder a esta sección.")}`,
    );
  }
  return session;
}

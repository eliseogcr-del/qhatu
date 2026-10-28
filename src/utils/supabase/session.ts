import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./server";
import { tieneOpcion } from "./opciones";

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
    .select(
      "empresa_id, rol, almacen_id, almacen_origen_id, puede_modificar_precios, puede_aplicar_descuento",
    )
    .eq("id", user.id)
    .single();

  if (error || !usuario) {
    throw new Error(
      "Tu usuario no tiene un perfil de empresa asociado. Contacta al administrador.",
    );
  }

  const esAdmin = usuario.rol === "admin";

  return {
    userId: user.id,
    empresaId: usuario.empresa_id as string,
    rol: usuario.rol as string,
    // null = admin (ve/opera en todos los almacenes); para un vendedor
    // siempre viene fijo por el administrador desde Usuarios.
    almacenId: usuario.almacen_id as string | null,
    // Solo relevante para admin/logística (almacenId null) — almacén
    // sugerido para preseleccionar el selector, y último recurso en
    // pantallas sin selector propio (ej. Venta rápida). Ver
    // resolverAlmacenId: nunca se usa si hay un almacenId fijo o si el
    // formulario ya trae uno elegido a mano.
    almacenIdOrigen: usuario.almacen_origen_id as string | null,
    // Antes era un interruptor único por empresa (configuracion_precios);
    // ahora cada usuario tiene el suyo (módulo Permisos) — admin siempre
    // puede ambas cosas, sin importar esas columnas.
    preciosBloqueados: esAdmin ? false : !usuario.puede_modificar_precios,
    descuentoHabilitado: esAdmin ? true : usuario.puede_aplicar_descuento,
  };
}

// Resuelve a qué almacén pertenece el movimiento que se está registrando:
// si el usuario tiene un almacén fijo (vendedor/producción) se usa ese,
// ignorando cualquier valor del formulario; si no lo tiene (admin/
// logística, ven todos), se toma del selector que el formulario incluya
// en ese caso, y si la pantalla ni siquiera tiene selector (Venta rápida)
// se cae al almacén de origen sugerido en su perfil — nunca queda en null
// a ciegas.
export function resolverAlmacenId(
  session: { almacenId: string | null; almacenIdOrigen?: string | null },
  formData: FormData,
): string | null {
  if (session.almacenId) return session.almacenId;
  const value = formData.get("almacen_id");
  if (value) return String(value);
  return session.almacenIdOrigen ?? null;
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
// sea administrador ni logística — salvo que se le haya concedido
// puntualmente la opción correspondiente desde el módulo de Permisos
// (opcionCodigo). Esta función también gatea una acción sensible de
// Compras que no tiene opción propia (no se le pasa opcionCodigo ahí a
// propósito, para no tocar ese caso).
export async function requireLogisticaOAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opcionCodigo?: string,
) {
  const session = await getEmpresaSession(supabase);
  if (
    session.rol !== "admin" &&
    session.rol !== "logistica" &&
    !(opcionCodigo && (await tieneOpcion(supabase, session.userId, opcionCodigo)))
  ) {
    redirect(
      `/dashboard?error=${encodeURIComponent("No tienes permisos para acceder a esta sección.")}`,
    );
  }
  return session;
}

// Cotizaciones: visible para admin, logística y vendedor — el repartidor
// no cotiza ni ve el módulo comercial, salvo que se le conceda
// puntualmente la opción "/cotizaciones" desde Permisos.
export async function requireComercial(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const session = await getEmpresaSession(supabase);
  if (
    !["admin", "logistica", "vendedor"].includes(session.rol) &&
    !(await tieneOpcion(supabase, session.userId, "/cotizaciones"))
  ) {
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
// Promociones, secciones fuera del alcance de este rol. También entra
// quien tenga concedida puntualmente la opción "/produccion".
export async function requireProduccionOAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const session = await getEmpresaSession(supabase);
  if (
    !["admin", "logistica", "produccion"].includes(session.rol) &&
    !(await tieneOpcion(supabase, session.userId, "/produccion"))
  ) {
    redirect(
      `/dashboard?error=${encodeURIComponent("No tienes permisos para acceder a esta sección.")}`,
    );
  }
  return session;
}

// Comprobantes: además de admin/logística, el rol "contador" también
// entra — es el único módulo al que tiene acceso por defecto. Cubre dos
// opciones distintas del catálogo ("/comprobantes" y "/comprobantes-libres"),
// así que cada página pasa la que le corresponde en opcionCodigo para que
// una concesión puntual de una no abra la otra de regalo.
export async function requireComprobantesAcceso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opcionCodigo?: string,
) {
  const session = await getEmpresaSession(supabase);
  if (
    !["admin", "logistica", "contador"].includes(session.rol) &&
    !(opcionCodigo && (await tieneOpcion(supabase, session.userId, opcionCodigo)))
  ) {
    redirect(
      `/dashboard?error=${encodeURIComponent("No tienes permisos para acceder a esta sección.")}`,
    );
  }
  return session;
}

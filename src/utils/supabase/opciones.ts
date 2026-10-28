import { createClient } from "./server";

// Todas las opciones concedidas a un usuario — las usa el layout para
// armar su sidebar y el módulo de Permisos para precargar el árbol de
// checks de ese usuario.
export async function obtenerOpcionesUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("usuario_opciones")
    .select("opcion_codigo")
    .eq("usuario_id", usuarioId);
  return new Set((data ?? []).map((r) => r.opcion_codigo as string));
}

// Para los require* que amplían su chequeo de rol con un permiso
// concedido puntualmente a un usuario que por rol no lo tendría (ver
// session.ts) — una sola opción, no hace falta traer todo el set.
export async function tieneOpcion(
  supabase: Awaited<ReturnType<typeof createClient>>,
  usuarioId: string,
  codigo: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("usuario_opciones")
    .select("opcion_codigo")
    .eq("usuario_id", usuarioId)
    .eq("opcion_codigo", codigo)
    .maybeSingle();
  return Boolean(data);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/utils/supabase/session";
import { OPCIONES_SISTEMA } from "@/lib/opciones-sistema";

const CODIGOS_VALIDOS = new Set(OPCIONES_SISTEMA.map((o) => o.codigo));

export async function guardarPermisosUsuario(usuarioId: string, formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  // El usuario tiene que ser de la misma empresa y no admin (admin ya
  // tiene todo siempre, no se le administra nada acá) — evita que alguien
  // arme a mano un usuarioId de otra empresa.
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("id, rol")
    .eq("id", usuarioId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!usuario || usuario.rol === "admin") {
    redirect(`/usuarios/permisos?error=${encodeURIComponent("Usuario inválido.")}`);
  }

  // Se descartan códigos que no existan en el catálogo actual — por si
  // llegó un valor manipulado a mano en el formulario.
  const codigosMarcados = formData
    .getAll("opciones[]")
    .map((v) => String(v))
    .filter((codigo) => CODIGOS_VALIDOS.has(codigo));

  const puedeModificarPrecios = formData.get("puede_modificar_precios") === "on";
  const puedeAplicarDescuento = formData.get("puede_aplicar_descuento") === "on";

  // Reemplazo completo: se borra todo lo que tenía y se insertan solo los
  // códigos marcados ahora — más simple y seguro que calcular un diff, y
  // la tabla es chica por usuario (decenas de filas, no miles).
  const { error: deleteError } = await supabase
    .from("usuario_opciones")
    .delete()
    .eq("usuario_id", usuarioId);

  if (deleteError) {
    redirect(`/usuarios/permisos?usuario_id=${usuarioId}&error=${encodeURIComponent(deleteError.message)}`);
  }

  if (codigosMarcados.length > 0) {
    const { error: insertError } = await supabase
      .from("usuario_opciones")
      .insert(codigosMarcados.map((codigo) => ({ usuario_id: usuarioId, opcion_codigo: codigo })));

    if (insertError) {
      redirect(`/usuarios/permisos?usuario_id=${usuarioId}&error=${encodeURIComponent(insertError.message)}`);
    }
  }

  // La tabla usuarios solo admite escritura desde el cliente con
  // privilegios de administrador (grant a nivel de Postgres, no solo
  // RLS) — mismo motivo por el que toggleActivoUsuario/updateUsuario
  // usan createAdminClient() en vez del cliente normal.
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("usuarios")
    .update({
      puede_modificar_precios: puedeModificarPrecios,
      puede_aplicar_descuento: puedeAplicarDescuento,
    })
    .eq("id", usuarioId);

  if (updateError) {
    redirect(`/usuarios/permisos?usuario_id=${usuarioId}&error=${encodeURIComponent(updateError.message)}`);
  }

  revalidatePath("/usuarios/permisos");
  redirect(`/usuarios/permisos?usuario_id=${usuarioId}&guardado=1`);
}

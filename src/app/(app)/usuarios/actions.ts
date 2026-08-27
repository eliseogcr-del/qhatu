"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/utils/supabase/session";
import { ROLES, requiereAlmacen } from "@/lib/roles";

// El username es lo único que la persona escribe para entrar — nunca un
// correo. Supabase Auth igual necesita un email por dentro, así que si el
// admin no carga uno real se genera uno sintético a partir del username
// (nunca se muestra ni se usa para nada más que satisfacer a Auth).
const DIACRITICOS = new RegExp("[̀-ͯ]", "g");

function emailSinteticoDesde(username: string): string {
  const local =
    username
      .toLowerCase()
      .normalize("NFD")
      .replace(DIACRITICOS, "")
      .replace(/[^a-z0-9]+/g, ".")
      .replace(/^\.+|\.+$/g, "") || "usuario";
  return `${local}@qhatu.local`;
}

export async function createUsuario(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const username = String(formData.get("username") ?? "").trim();
  const emailIngresado = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const rolRaw = String(formData.get("rol") ?? "vendedor");
  const rol = ROLES.includes(rolRaw as (typeof ROLES)[number]) ? rolRaw : "vendedor";
  const activo = formData.get("activo") === "on";
  const almacenIdRaw = String(formData.get("almacen_id") ?? "");
  const almacenId = requiereAlmacen(rol) ? almacenIdRaw || null : null;

  if (!username || !nombre || password.length < 6) {
    redirect(
      `/usuarios/nuevo?error=${encodeURIComponent("Completa usuario y nombre, con una contraseña de al menos 6 caracteres.")}`,
    );
  }

  if (requiereAlmacen(rol) && !almacenId) {
    redirect(
      `/usuarios/nuevo?error=${encodeURIComponent("Selecciona el almacén/local al que pertenece este usuario.")}`,
    );
  }

  const admin = createAdminClient();

  // El username debe ser único en todo el sistema (no solo en la empresa),
  // porque termina mapeado 1:1 a un email de Supabase Auth, que es global
  // — por eso se verifica con el cliente admin (sin restricción de RLS por
  // empresa) en vez del cliente normal.
  const { data: existente } = await admin
    .from("usuarios")
    .select("id")
    .ilike("username", username)
    .maybeSingle();

  if (existente) {
    redirect(
      `/usuarios/nuevo?error=${encodeURIComponent("Ese nombre de usuario ya está en uso.")}`,
    );
  }

  const email = emailIngresado || emailSinteticoDesde(username);

  const { data: creado, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !creado.user) {
    redirect(
      `/usuarios/nuevo?error=${encodeURIComponent(authError?.message ?? "No se pudo crear el usuario.")}`,
    );
  }

  const { error: perfilError } = await admin.from("usuarios").insert({
    id: creado.user.id,
    empresa_id: empresaId,
    username,
    nombre,
    rol,
    activo,
    almacen_id: almacenId,
  });

  if (perfilError) {
    // Revierte el usuario de Auth para no dejar una cuenta huérfana sin perfil.
    await admin.auth.admin.deleteUser(creado.user.id);
    redirect(`/usuarios/nuevo?error=${encodeURIComponent(perfilError.message)}`);
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function updateUsuario(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const username = String(formData.get("username") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rolRaw = String(formData.get("rol") ?? "vendedor");
  const rol = ROLES.includes(rolRaw as (typeof ROLES)[number]) ? rolRaw : "vendedor";
  const activo = formData.get("activo") === "on";
  const almacenIdRaw = String(formData.get("almacen_id") ?? "");
  const almacenId = requiereAlmacen(rol) ? almacenIdRaw || null : null;

  if (!username || !nombre) {
    redirect(
      `/usuarios/${id}/editar?error=${encodeURIComponent("Usuario y nombre son obligatorios.")}`,
    );
  }

  if (password && password.length < 6) {
    redirect(
      `/usuarios/${id}/editar?error=${encodeURIComponent("La nueva contraseña debe tener al menos 6 caracteres.")}`,
    );
  }

  if (requiereAlmacen(rol) && !almacenId) {
    redirect(
      `/usuarios/${id}/editar?error=${encodeURIComponent("Selecciona el almacén/local al que pertenece este usuario.")}`,
    );
  }

  const admin = createAdminClient();

  const { data: existente } = await admin
    .from("usuarios")
    .select("id")
    .ilike("username", username)
    .neq("id", id)
    .maybeSingle();

  if (existente) {
    redirect(
      `/usuarios/${id}/editar?error=${encodeURIComponent("Ese nombre de usuario ya está en uso.")}`,
    );
  }

  if (password) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(id, { password });
    if (passwordError) {
      redirect(`/usuarios/${id}/editar?error=${encodeURIComponent(passwordError.message)}`);
    }
  }

  const { error } = await admin
    .from("usuarios")
    .update({ username, nombre, rol, activo, almacen_id: almacenId })
    .eq("id", id);

  if (error) {
    redirect(`/usuarios/${id}/editar?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function toggleActivoUsuario(id: string, activo: boolean) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const admin = createAdminClient();
  const { error } = await admin.from("usuarios").update({ activo }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/usuarios");
}

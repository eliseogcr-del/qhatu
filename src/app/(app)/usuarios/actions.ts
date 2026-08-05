"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { requireAdmin } from "@/utils/supabase/session";

export async function createUsuario(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nombre = String(formData.get("nombre") ?? "").trim();
  const rol = String(formData.get("rol") ?? "vendedor");
  const activo = formData.get("activo") === "on";

  if (!email || !nombre || password.length < 6) {
    redirect(
      `/usuarios/nuevo?error=${encodeURIComponent("Completa correo y nombre, con una contraseña de al menos 6 caracteres.")}`,
    );
  }

  const admin = createAdminClient();

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
    nombre,
    rol,
    activo,
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

  const nombre = String(formData.get("nombre") ?? "").trim();
  const rol = String(formData.get("rol") ?? "vendedor");
  const activo = formData.get("activo") === "on";

  if (!nombre) {
    redirect(`/usuarios/${id}/editar?error=${encodeURIComponent("El nombre es obligatorio.")}`);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("usuarios")
    .update({ nombre, rol, activo })
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

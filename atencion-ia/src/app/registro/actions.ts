"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";

function fail(mensaje: string): never {
  redirect(`/registro?error=${encodeURIComponent(mensaje)}`);
}

// Alta self-service de un tenant nuevo: crea la empresa, el usuario admin
// en Supabase Auth y su fila de perfil, todo con la service_role key porque
// nada de esto tiene sesión (ni por lo tanto RLS) todavía.
export async function registrarTenant(formData: FormData) {
  const empresa = String(formData.get("empresa") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!empresa || !nombre || !email || !password) {
    fail("Completa todos los campos.");
  }
  if (password.length < 8) {
    fail("La contraseña debe tener al menos 8 caracteres.");
  }

  const admin = createAdminClient();

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .insert({ nombre: empresa })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    fail("No se pudo crear la empresa. Intenta de nuevo.");
  }

  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError || !authData.user) {
    await admin.from("tenants").delete().eq("id", tenant.id);
    fail(
      authError?.message === "A user with this email address has already been registered"
        ? "Ese correo ya tiene una cuenta."
        : "No se pudo crear el usuario. Intenta de nuevo.",
    );
  }

  const { error: usuarioError } = await admin.from("usuarios").insert({
    id: authData.user.id,
    tenant_id: tenant.id,
    nombre,
    email,
    rol: "admin",
  });

  if (usuarioError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    await admin.from("tenants").delete().eq("id", tenant.id);
    fail("No se pudo crear tu perfil. Intenta de nuevo.");
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    redirect("/login");
  }

  redirect("/dashboard");
}

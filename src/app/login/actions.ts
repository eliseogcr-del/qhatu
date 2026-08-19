"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  // El username nunca se le manda a Supabase Auth directamente — se
  // traduce primero al email real detrás de esa cuenta. Si no existe,
  // se sigue intentando el sign-in igual (con un email vacío) para que
  // el mensaje de error sea el mismo genérico, y no delate si el usuario
  // existe o no.
  const { data: email } = await supabase.rpc("email_por_username", {
    p_username: username,
  });

  const { error } = await supabase.auth.signInWithPassword({
    email: email ?? "",
    password,
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent("Usuario o contraseña incorrectos.")}`,
    );
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

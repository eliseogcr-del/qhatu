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
    .select("empresa_id")
    .eq("id", user.id)
    .single();

  if (error || !usuario) {
    throw new Error(
      "Tu usuario no tiene un perfil de empresa asociado. Contacta al administrador.",
    );
  }

  return { userId: user.id, empresaId: usuario.empresa_id as string };
}

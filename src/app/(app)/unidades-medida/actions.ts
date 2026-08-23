"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";

export async function createUnidadMedida(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const codigo = String(formData.get("codigo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const cantidad = Number(formData.get("cantidad") ?? 0);
  const activo = formData.get("activo") === "on";

  if (!codigo || !descripcion || !(cantidad > 0)) {
    redirect(
      `/unidades-medida/nuevo?error=${encodeURIComponent("Completa código, descripción y una cantidad mayor a 0.")}`,
    );
  }

  const { error } = await supabase
    .from("unidades_medida")
    .insert({ empresa_id: empresaId, codigo, descripcion, cantidad, activo });

  if (error) {
    redirect(`/unidades-medida/nuevo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/unidades-medida");
  redirect("/unidades-medida");
}

export async function updateUnidadMedida(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const codigo = String(formData.get("codigo") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const cantidad = Number(formData.get("cantidad") ?? 0);
  const activo = formData.get("activo") === "on";

  if (!codigo || !descripcion || !(cantidad > 0)) {
    redirect(
      `/unidades-medida/${id}/editar?error=${encodeURIComponent("Completa código, descripción y una cantidad mayor a 0.")}`,
    );
  }

  const { error } = await supabase
    .from("unidades_medida")
    .update({ codigo, descripcion, cantidad, activo })
    .eq("id", id);

  if (error) {
    redirect(`/unidades-medida/${id}/editar?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/unidades-medida");
  redirect("/unidades-medida");
}

export async function toggleActivoUnidadMedida(id: string, activo: boolean) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase
    .from("unidades_medida")
    .update({ activo })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/unidades-medida");
}

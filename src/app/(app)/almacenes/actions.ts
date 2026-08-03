"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";

export async function createAlmacen(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await getEmpresaSession(supabase);

  const nombre = String(formData.get("nombre") ?? "");
  const direccion = String(formData.get("direccion") ?? "") || null;

  const { error } = await supabase
    .from("almacenes")
    .insert({ empresa_id: empresaId, nombre, direccion });

  if (error) {
    redirect(`/almacenes?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/almacenes");
  redirect("/almacenes");
}

export async function toggleActivoAlmacen(id: string, activo: boolean) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  const { error } = await supabase
    .from("almacenes")
    .update({ activo })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/almacenes");
}

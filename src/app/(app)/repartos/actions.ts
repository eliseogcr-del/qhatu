"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { ESTADOS_REPARTO, type EstadoReparto } from "@/lib/reparto-estados";

function repartoFromForm(formData: FormData) {
  const text = (key: string) => {
    const raw = formData.get(key);
    return raw === null || raw === "" ? null : String(raw);
  };

  return {
    pedido_id: String(formData.get("pedido_id") ?? ""),
    fecha_reparto: text("fecha_reparto"),
    tipo_transporte: String(formData.get("tipo_transporte") ?? "repartidor_propio"),
    transportista_nombre: text("transportista_nombre"),
    repartidor_id: text("repartidor_id"),
    estado: String(formData.get("estado") ?? "pendiente"),
  };
}

export async function createReparto(formData: FormData) {
  const supabase = await createClient();
  const { empresaId: empresa_id } = await getEmpresaSession(supabase);
  const reparto = repartoFromForm(formData);

  const { error } = await supabase
    .from("repartos")
    .insert({ ...reparto, empresa_id });

  if (error) {
    redirect(`/repartos/nuevo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/repartos");
  redirect("/repartos");
}

export async function updateReparto(id: string, formData: FormData) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);
  const reparto = repartoFromForm(formData);

  const { error } = await supabase
    .from("repartos")
    .update(reparto)
    .eq("id", id);

  if (error) {
    redirect(
      `/repartos/${id}/editar?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/repartos");
  revalidatePath(`/repartos/${id}/editar`);
  redirect("/repartos");
}

// Acción angosta pensada para el repartidor: solo toca el estado, nunca
// reasigna el pedido, el transporte ni el repartidor — a diferencia de
// updateReparto (edición completa, reservada a admin/logística/vendedor).
export async function actualizarEstadoReparto(id: string, estado: string) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  if (!ESTADOS_REPARTO.includes(estado as EstadoReparto)) {
    throw new Error("Estado inválido.");
  }

  const { error } = await supabase.from("repartos").update({ estado }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/mis-repartos");
  revalidatePath("/repartos");
}

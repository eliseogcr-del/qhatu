"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";

export async function actualizarBloqueoPrecios(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const bloqueados = formData.get("precios_bloqueados") === "on";

  const { error } = await supabase
    .from("configuracion_precios")
    .upsert(
      { empresa_id: empresaId, precios_bloqueados: bloqueados },
      { onConflict: "empresa_id" },
    );

  if (error) {
    redirect(`/configuracion-precios?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/configuracion-precios");
  redirect("/configuracion-precios?guardado=1");
}

export async function crearPrecioEspecial(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const clienteId = String(formData.get("cliente_id") ?? "");
  const productoId = String(formData.get("producto_id") ?? "");
  const precio = Number(formData.get("precio") ?? 0);

  if (!clienteId || !productoId) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("Selecciona un cliente y un producto.")}`,
    );
  }
  if (!(precio > 0)) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("El precio especial debe ser mayor a 0.")}`,
    );
  }

  const { error } = await supabase.from("precios_especiales_cliente").upsert(
    { empresa_id: empresaId, cliente_id: clienteId, producto_id: productoId, precio },
    { onConflict: "empresa_id,cliente_id,producto_id" },
  );

  if (error) {
    redirect(`/configuracion-precios?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/configuracion-precios");
  redirect("/configuracion-precios");
}

export async function eliminarPrecioEspecial(id: string) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { error } = await supabase
    .from("precios_especiales_cliente")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/configuracion-precios");
}

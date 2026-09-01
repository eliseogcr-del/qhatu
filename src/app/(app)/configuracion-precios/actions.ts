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
  const unidadMedidaId = String(formData.get("unidad_medida_id") ?? "");
  const precio = Number(formData.get("precio") ?? 0);

  if (!clienteId || !productoId || !unidadMedidaId) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("Selecciona un cliente, un producto y la unidad de medida.")}`,
    );
  }
  if (!(precio > 0)) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("El precio especial debe ser mayor a 0.")}&cliente_id=${clienteId}&producto_id=${productoId}`,
    );
  }

  const { data: existente } = await supabase
    .from("precios_especiales_cliente")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("cliente_id", clienteId)
    .eq("producto_id", productoId)
    .maybeSingle();

  if (existente) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("Este cliente ya tiene un precio especial para ese producto. Quítalo primero si quieres cambiar el precio.")}&cliente_id=${clienteId}&producto_id=${productoId}`,
    );
  }

  const { error } = await supabase.from("precios_especiales_cliente").insert({
    empresa_id: empresaId,
    cliente_id: clienteId,
    producto_id: productoId,
    unidad_medida_id: unidadMedidaId,
    precio,
  });

  if (error) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent(error.message)}&cliente_id=${clienteId}&producto_id=${productoId}`,
    );
  }

  revalidatePath("/configuracion-precios");
  redirect(`/configuracion-precios?guardado=1&cliente_id=${clienteId}&producto_id=${productoId}`);
}

export async function actualizarPrecioEspecial(id: string, formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const precio = Number(formData.get("precio") ?? 0);

  if (!(precio > 0)) {
    redirect(
      `/configuracion-precios?error=${encodeURIComponent("El precio especial debe ser mayor a 0.")}`,
    );
  }

  const { error } = await supabase
    .from("precios_especiales_cliente")
    .update({ precio })
    .eq("id", id)
    .eq("empresa_id", empresaId);

  if (error) {
    redirect(`/configuracion-precios?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/configuracion-precios");
  redirect("/configuracion-precios?guardado=1");
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

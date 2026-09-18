"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireLogisticaOAdmin } from "@/utils/supabase/session";

// Una promoción es un producto "espejo" atado a un producto real: solo
// se vende junto a él (ver validación en ventas/actions.ts). El monto
// que se ingresa acá es positivo (lo que se descuenta); se guarda como
// negativo en precio_campo/precio_digital para que, al agregarla como
// línea de venta (cantidad 1), su subtotal reste del total sin tocar
// ningún cálculo de precios/totales ya existente. control_inventario
// queda en false (no mueve stock) y activo en false (para que las demás
// pantallas de productos la ignoren) — la visibilidad real es
// promocion_activa.
export async function crearPromocion(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireLogisticaOAdmin(supabase);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const productoId = String(formData.get("promocion_de_producto_id") ?? "");
  const monto = Number(formData.get("monto") ?? 0);
  const activa = formData.get("promocion_activa") === "on";

  if (!nombre || !productoId) {
    redirect(
      `/promociones?error=${encodeURIComponent("Ingresa un nombre y selecciona el producto atado a la promoción.")}`,
    );
  }
  if (!(monto > 0)) {
    redirect(
      `/promociones?error=${encodeURIComponent("El monto de la promoción debe ser mayor a 0.")}`,
    );
  }

  const { data: producto } = await supabase
    .from("productos")
    .select("id, unidad_medida_id, es_promocion")
    .eq("id", productoId)
    .maybeSingle();

  if (!producto || producto.es_promocion) {
    redirect(
      `/promociones?error=${encodeURIComponent("Selecciona un producto real (no otra promoción).")}`,
    );
  }

  const { error } = await supabase.from("productos").insert({
    empresa_id: empresaId,
    nombre,
    unidad_medida_id: producto.unidad_medida_id,
    precio_campo: -monto,
    precio_digital: -monto,
    control_inventario: false,
    precio_editable: false,
    activo: false,
    es_promocion: true,
    promocion_de_producto_id: productoId,
    promocion_activa: activa,
  });

  if (error) {
    redirect(`/promociones?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/promociones");
  redirect("/promociones?guardado=1");
}

export async function actualizarPromocion(id: string, formData: FormData) {
  const supabase = await createClient();
  await requireLogisticaOAdmin(supabase);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const monto = Number(formData.get("monto") ?? 0);

  if (!nombre) {
    redirect(`/promociones?error=${encodeURIComponent("Ingresa un nombre.")}`);
  }
  if (!(monto > 0)) {
    redirect(
      `/promociones?error=${encodeURIComponent("El monto de la promoción debe ser mayor a 0.")}`,
    );
  }

  const { error } = await supabase
    .from("productos")
    .update({ nombre, precio_campo: -monto, precio_digital: -monto })
    .eq("id", id)
    .eq("es_promocion", true);

  if (error) {
    redirect(`/promociones?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/promociones");
  redirect("/promociones?guardado=1");
}

// productos no tiene política ni permiso de delete (se retira vía
// "activo", no se borra — ver 20260803000200_productos.sql). Una
// promoción es un producto, así que se retira de la misma forma:
// promocion_activa en false, nunca un delete.
export async function alternarPromocionActiva(id: string, activa: boolean) {
  const supabase = await createClient();
  await requireLogisticaOAdmin(supabase);

  const { error } = await supabase
    .from("productos")
    .update({ promocion_activa: activa })
    .eq("id", id)
    .eq("es_promocion", true);

  if (error) throw new Error(error.message);

  revalidatePath("/promociones");
}

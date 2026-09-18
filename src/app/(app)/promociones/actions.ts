"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireLogisticaOAdmin } from "@/utils/supabase/session";

// Una promoción es un producto "espejo" atado a un producto real: solo
// se vende junto a él, y en múltiplos de promocion_cantidad_minima (ej.
// "lleva 12 y la 13 gratis" -> con 24 en la venta se agregan 2 gratis).
// Por cada múltiplo alcanzado se regala promocion_cantidad_regalo
// unidades (normalmente 1, pero soporta "compra 12, llévate 2 gratis")
// al precio unitario promocion_precio (normalmente 0, pero soporta
// "compra 12, paga la mitad" con un precio > 0 pero menor al normal).
// control_inventario queda en false porque la promoción no tiene stock
// propio — su descuento de inventario se registra contra
// promocion_de_producto_id (ver ventas/actions.ts) — y activo en false
// para que las demás pantallas de productos la ignoren; la visibilidad
// real es promocion_activa.
export async function crearPromocion(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireLogisticaOAdmin(supabase);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const productoId = String(formData.get("promocion_de_producto_id") ?? "");
  const cantidadMinima = Number(formData.get("cantidad_minima") || 1);
  const cantidadRegalo = Number(formData.get("cantidad_regalo") || 1);
  const precio = Number(formData.get("precio") || 0);
  const activa = formData.get("promocion_activa") === "on";
  const inicio = String(formData.get("promocion_inicio") ?? "").trim() || null;
  const fin = String(formData.get("promocion_fin") ?? "").trim() || null;

  if (!nombre || !productoId) {
    redirect(
      `/promociones?error=${encodeURIComponent("Ingresa un nombre y selecciona el producto atado a la promoción.")}`,
    );
  }
  if (!(cantidadMinima > 0)) {
    redirect(
      `/promociones?error=${encodeURIComponent("La cantidad mínima debe ser mayor a 0.")}`,
    );
  }
  if (!(cantidadRegalo > 0)) {
    redirect(
      `/promociones?error=${encodeURIComponent("La cantidad a regalar debe ser mayor a 0.")}`,
    );
  }
  if (!(precio >= 0)) {
    redirect(`/promociones?error=${encodeURIComponent("El precio no puede ser negativo.")}`);
  }
  if (inicio && fin && new Date(fin) <= new Date(inicio)) {
    redirect(
      `/promociones?error=${encodeURIComponent("El fin de la campaña debe ser posterior al inicio.")}`,
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
    precio_campo: 0,
    precio_digital: 0,
    control_inventario: false,
    precio_editable: false,
    activo: false,
    es_promocion: true,
    promocion_de_producto_id: productoId,
    promocion_cantidad_minima: cantidadMinima,
    promocion_cantidad_regalo: cantidadRegalo,
    promocion_precio: precio,
    promocion_activa: activa,
    promocion_inicio: inicio,
    promocion_fin: fin,
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
  const cantidadMinima = Number(formData.get("cantidad_minima") || 1);
  const cantidadRegalo = Number(formData.get("cantidad_regalo") || 1);
  const precio = Number(formData.get("precio") || 0);
  const inicio = String(formData.get("promocion_inicio") ?? "").trim() || null;
  const fin = String(formData.get("promocion_fin") ?? "").trim() || null;

  if (!nombre) {
    redirect(`/promociones?error=${encodeURIComponent("Ingresa un nombre.")}`);
  }
  if (!(cantidadMinima > 0)) {
    redirect(
      `/promociones?error=${encodeURIComponent("La cantidad mínima debe ser mayor a 0.")}`,
    );
  }
  if (!(cantidadRegalo > 0)) {
    redirect(
      `/promociones?error=${encodeURIComponent("La cantidad a regalar debe ser mayor a 0.")}`,
    );
  }
  if (!(precio >= 0)) {
    redirect(`/promociones?error=${encodeURIComponent("El precio no puede ser negativo.")}`);
  }
  if (inicio && fin && new Date(fin) <= new Date(inicio)) {
    redirect(
      `/promociones?error=${encodeURIComponent("El fin de la campaña debe ser posterior al inicio.")}`,
    );
  }

  const { error } = await supabase
    .from("productos")
    .update({
      nombre,
      promocion_cantidad_minima: cantidadMinima,
      promocion_cantidad_regalo: cantidadRegalo,
      promocion_precio: precio,
      promocion_inicio: inicio,
      promocion_fin: fin,
    })
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

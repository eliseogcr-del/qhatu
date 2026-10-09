"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { registrarMovimientoKardex } from "@/utils/supabase/kardex";

export async function registrarMovimientoManual(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const productoId = String(formData.get("producto_id") ?? "");
  const almacenId = String(formData.get("almacen_id") ?? "");
  const tipoMovimiento = String(formData.get("tipo_movimiento") ?? "ajuste");
  const direccion = String(formData.get("direccion") ?? "entrada");
  const unidadMedidaId = String(formData.get("unidad_medida_id") ?? "");
  const cantidad = Number(formData.get("cantidad") ?? 0);
  const nota = String(formData.get("nota") ?? "").trim();

  if (!productoId || !almacenId || !unidadMedidaId || cantidad <= 0) {
    redirect(
      `/inventario/movimiento?error=${encodeURIComponent("Selecciona producto, almacén, unidad de medida y una cantidad mayor a 0.")}`,
    );
  }

  const { data: unidad } = await supabase
    .from("unidades_medida")
    .select("descripcion, cantidad")
    .eq("id", unidadMedidaId)
    .single();

  if (!unidad) {
    redirect(
      `/inventario/movimiento?error=${encodeURIComponent("Unidad de medida inválida.")}`,
    );
  }

  // El kardex/inventario siempre se mueve en la unidad base del producto
  // (factor 1) — lo que se elige acá es solo cómo se está contando la
  // cantidad físicamente (ej. "5 bandejas"), y se convierte antes de
  // tocar el stock para no tener que hacer esa cuenta a mano.
  const cantidadBase = Math.round(cantidad * unidad.cantidad * 100) / 100;
  const cantidadFirmada = direccion === "salida" ? -cantidadBase : cantidadBase;

  // La nota del usuario (motivo del ajuste) y el detalle de conversión de
  // unidad son independientes entre sí — se concatenan cuando ambos
  // existen en vez de que uno pise al otro.
  const detalleConversion =
    unidad.cantidad !== 1
      ? `Ingresado como ${cantidad} ${unidad.descripcion} (= ${cantidadBase} unidades).`
      : null;
  const detalle = [detalleConversion, nota || null].filter(Boolean).join(" ") || null;

  await registrarMovimientoKardex(supabase, {
    empresaId,
    productoId,
    almacenId,
    tipoMovimiento,
    cantidad: cantidadFirmada,
    usuarioId: userId,
    detalle,
  });

  revalidatePath("/inventario");
  revalidatePath("/kardex");
  redirect("/inventario");
}

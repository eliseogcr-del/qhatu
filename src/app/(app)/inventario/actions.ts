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
  const cantidad = Number(formData.get("cantidad") ?? 0);

  if (!productoId || !almacenId || cantidad <= 0) {
    redirect(
      `/inventario/movimiento?error=${encodeURIComponent("Selecciona producto, almacén y una cantidad mayor a 0.")}`,
    );
  }

  const cantidadFirmada = direccion === "salida" ? -cantidad : cantidad;

  await registrarMovimientoKardex(supabase, {
    empresaId,
    productoId,
    almacenId,
    tipoMovimiento,
    cantidad: cantidadFirmada,
    usuarioId: userId,
  });

  revalidatePath("/inventario");
  revalidatePath("/kardex");
  redirect("/inventario");
}

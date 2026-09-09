"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";

// Solo actualiza unidad_venta_defecto_id — el atajo de UX que preselecciona
// la unidad al agregar el producto en Pedidos/Ventas/Cotizaciones. Nunca
// toca unidad_medida_id (la base real de precio e inventario).
export async function actualizarUnidadVentaPreferida(productoId: string, formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const unidadVentaDefectoId = String(formData.get("unidad_venta_defecto_id") ?? "") || null;
  const q = String(formData.get("_q") ?? "");
  const qs = q ? `?q=${encodeURIComponent(q)}` : "";

  const { error } = await supabase
    .from("productos")
    .update({ unidad_venta_defecto_id: unidadVentaDefectoId })
    .eq("id", productoId)
    .eq("empresa_id", empresaId);

  if (error) {
    redirect(
      `/unidades-venta-preferidas${qs ? `${qs}&` : "?"}error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/unidades-venta-preferidas");
  redirect(`/unidades-venta-preferidas${qs ? `${qs}&` : "?"}guardado=1`);
}

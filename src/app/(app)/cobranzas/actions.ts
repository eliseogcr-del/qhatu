"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";

export async function createCobranza(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const pedidoId = String(formData.get("pedido_id") ?? "");
  const monto = Number(formData.get("monto") ?? 0);
  const moneda = String(formData.get("moneda") ?? "PEN");
  const tipoCambio = Number(formData.get("tipo_cambio_aplicado") ?? 1);
  const metodoPago = String(formData.get("metodo_pago") ?? "efectivo");
  const referencia = String(formData.get("referencia") ?? "") || null;

  if (!pedidoId || monto <= 0) {
    redirect(
      `/cobranzas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent("Ingresa un monto válido.")}`,
    );
  }

  const { data: venta } = await supabase
    .from("ventas")
    .select("id")
    .eq("pedido_id", pedidoId)
    .maybeSingle();

  const { error } = await supabase.from("cobranzas").insert({
    empresa_id: empresaId,
    pedido_id: pedidoId,
    venta_id: venta?.id ?? null,
    monto,
    moneda,
    tipo_cambio_aplicado: tipoCambio,
    metodo_pago: metodoPago,
    tipo_pago: venta ? "pago" : "anticipo",
    referencia,
    usuario_id: userId,
  });

  if (error) {
    redirect(
      `/cobranzas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/cobranzas");
  revalidatePath(`/pedidos/${pedidoId}`);
  redirect(`/pedidos/${pedidoId}`);
}

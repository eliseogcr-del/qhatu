"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { registrarAuditoria, TIPO_AUDITORIA } from "@/utils/supabase/auditoria";

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

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, total")
    .eq("id", pedidoId)
    .single();

  if (!pedido) {
    redirect(`/cobranzas/nueva?error=${encodeURIComponent("El pedido no existe.")}`);
  }

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, total")
    .eq("pedido_id", pedidoId)
    .maybeSingle();

  const { data: cobranzasPrevias } = await supabase
    .from("cobranzas")
    .select("monto")
    .eq(venta ? "venta_id" : "pedido_id", venta ? venta.id : pedidoId)
    .eq("estado", "activa");

  const totalReferencia = venta ? venta.total : pedido.total;
  const cobradoPrevio = (cobranzasPrevias ?? []).reduce((acc, c) => acc + c.monto, 0);
  const saldoPendiente = Math.round((totalReferencia - cobradoPrevio) * 100) / 100;

  if (monto > saldoPendiente) {
    redirect(
      `/cobranzas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent(
        `El monto (${monto.toFixed(2)}) no puede ser mayor al saldo pendiente (${saldoPendiente.toFixed(2)}).`,
      )}`,
    );
  }

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

// Un cobro nunca se borra — anularlo lo excluye del saldo cobrado pero
// conserva el registro, y queda auditado quién lo anuló y cuándo.
export async function anularCobranza(cobranzaId: string, redirectTo: string) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const { data: cobranza } = await supabase
    .from("cobranzas")
    .select("id, monto, moneda, metodo_pago, referencia, estado, venta_id, pedido_id")
    .eq("id", cobranzaId)
    .single();

  if (!cobranza || cobranza.estado === "anulada") {
    redirect(redirectTo);
  }

  await supabase.from("cobranzas").update({ estado: "anulada" }).eq("id", cobranzaId);

  await registrarAuditoria(supabase, {
    empresaId,
    usuarioId: userId,
    entidad: "cobranza",
    entidadId: cobranzaId,
    tipoMovimiento: TIPO_AUDITORIA.cobranzaAnular,
    monto: cobranza.monto,
    detalle: `Cobro anulado (${cobranza.moneda} ${cobranza.monto}, ${cobranza.metodo_pago}${
      cobranza.referencia ? `, ref: ${cobranza.referencia}` : ""
    }).`,
  });

  revalidatePath("/cobranzas");
  if (cobranza.venta_id) revalidatePath(`/ventas/${cobranza.venta_id}`);
  if (cobranza.pedido_id) revalidatePath(`/pedidos/${cobranza.pedido_id}`);
  redirect(redirectTo);
}

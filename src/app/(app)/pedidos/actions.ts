"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";

export async function createPedido(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const clienteId = String(formData.get("cliente_id") ?? "");
  const canalPedido = String(formData.get("canal_pedido") ?? "telefono");
  const fechaEntrega = formData.get("fecha_entrega_requerida");
  const moneda = String(formData.get("moneda") ?? "PEN");

  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);
  const precios = formData.getAll("precio_unitario[]").map(Number);

  const lineas = productoIds
    .map((producto_id, i) => ({
      producto_id,
      cantidad: cantidades[i],
      precio_unitario: precios[i],
      subtotal: Math.round(cantidades[i] * precios[i] * 100) / 100,
    }))
    .filter((l) => l.producto_id && l.cantidad > 0);

  if (lineas.length === 0) {
    redirect(
      `/pedidos/nuevo?error=${encodeURIComponent("Agrega al menos un producto al pedido.")}`,
    );
  }

  const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);

  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      canal_pedido: canalPedido,
      fecha_entrega_requerida: fechaEntrega || null,
      moneda,
      total,
      usuario_id: userId,
    })
    .select("id")
    .single();

  if (pedidoError || !pedido) {
    redirect(
      `/pedidos/nuevo?error=${encodeURIComponent(pedidoError?.message ?? "No se pudo crear el pedido.")}`,
    );
  }

  const { error: detalleError } = await supabase.from("pedido_detalle").insert(
    lineas.map((l) => ({ ...l, pedido_id: pedido.id })),
  );

  if (detalleError) {
    redirect(
      `/pedidos/nuevo?error=${encodeURIComponent(detalleError.message)}`,
    );
  }

  const archivos = formData
    .getAll("adjuntos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  for (const archivo of archivos) {
    const path = `${empresaId}/${pedido.id}/${randomUUID()}-${archivo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("pedido-adjuntos")
      .upload(path, archivo);

    if (!uploadError) {
      await supabase.from("pedido_adjuntos").insert({
        pedido_id: pedido.id,
        tipo_archivo: archivo.type || "application/octet-stream",
        url_archivo: path,
      });
    }
  }

  revalidatePath("/pedidos");
  redirect(`/pedidos/${pedido.id}`);
}

export async function updateEstadoPedido(id: string, estado: string) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  const { error } = await supabase
    .from("pedidos")
    .update({ estado })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
}

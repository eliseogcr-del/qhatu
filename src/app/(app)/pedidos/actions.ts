"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession, requireAdmin, resolverAlmacenId } from "@/utils/supabase/session";

export async function createPedido(formData: FormData) {
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);
  const { userId, empresaId } = session;

  const almacenId = resolverAlmacenId(session, formData);
  if (!almacenId) {
    redirect(
      `/pedidos/nuevo?error=${encodeURIComponent("Selecciona el almacén/local para este pedido.")}`,
    );
  }

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

  const productoIdsUnicos = new Set(lineas.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineas.length) {
    redirect(
      `/pedidos/nuevo?error=${encodeURIComponent("Hay un producto repetido en el pedido. Cada producto debe aparecer una sola vez.")}`,
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
      almacen_id: almacenId,
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

// El almacén de un pedido se fija al crearlo (el vendedor que lo atienda lo
// ve solo si coincide con el suyo). Si el admin lo asignó mal, o decide
// después a qué vendedor le toca, esto lo corrige — pero solo antes de que
// exista una venta, porque la venta ya copió su propio almacen_id al
// crearse y no se actualiza retroactivamente si el pedido cambia después.
export async function reasignarAlmacenPedido(id: string, formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const almacenId = String(formData.get("almacen_id") ?? "");
  if (!almacenId) {
    redirect(`/pedidos/${id}?error=${encodeURIComponent("Selecciona un almacén.")}`);
  }

  const { data: almacen } = await supabase
    .from("almacenes")
    .select("id")
    .eq("id", almacenId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!almacen) {
    redirect(`/pedidos/${id}?error=${encodeURIComponent("Almacén inválido.")}`);
  }

  const { data: ventaExistente } = await supabase
    .from("ventas")
    .select("id")
    .eq("pedido_id", id)
    .maybeSingle();

  if (ventaExistente) {
    redirect(
      `/pedidos/${id}?error=${encodeURIComponent(
        "Este pedido ya tiene una venta registrada — no se puede reasignar de almacén.",
      )}`,
    );
  }

  const { error } = await supabase
    .from("pedidos")
    .update({ almacen_id: almacenId })
    .eq("id", id);

  if (error) {
    redirect(`/pedidos/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
  redirect(`/pedidos/${id}`);
}

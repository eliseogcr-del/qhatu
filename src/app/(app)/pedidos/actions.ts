"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession, requireAdmin, resolverAlmacenId } from "@/utils/supabase/session";
import { preciosBloqueados, resolverPrecios, esAlmacenDigital } from "@/utils/supabase/precios";

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
  const unidadesMedidaIds = formData.getAll("unidad_medida_id[]").map(String);

  const lineasConProducto = productoIds
    .map((producto_id, i) => ({
      producto_id,
      cantidad: cantidades[i],
      precio_unitario: precios[i],
      unidad_medida_id: unidadesMedidaIds[i] || null,
    }))
    .filter((l) => l.producto_id);

  if (lineasConProducto.length === 0) {
    redirect(
      `/pedidos/nuevo?error=${encodeURIComponent("Agrega al menos un producto al pedido.")}`,
    );
  }

  if (lineasConProducto.some((l) => !(l.cantidad > 0) || !(l.precio_unitario > 0))) {
    redirect(
      `/pedidos/nuevo?error=${encodeURIComponent("Cada producto debe tener una cantidad y un precio unitario mayores a 0.")}`,
    );
  }

  if (lineasConProducto.some((l) => !l.unidad_medida_id)) {
    redirect(
      `/pedidos/nuevo?error=${encodeURIComponent("Selecciona la unidad de medida de cada producto.")}`,
    );
  }

  const productoIdsUnicos = new Set(lineasConProducto.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineasConProducto.length) {
    redirect(
      `/pedidos/nuevo?error=${encodeURIComponent("Hay un producto repetido en el pedido. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  // El precio nunca se confía del cliente cuando está bloqueado — se
  // recalcula acá con la misma lógica (especial > Campo/Digital) que se
  // usó para mostrarlo en el formulario.
  let lineasConPrecio = lineasConProducto;
  if (await preciosBloqueados(supabase, empresaId)) {
    const digital = await esAlmacenDigital(supabase, almacenId);
    const precios = await resolverPrecios(supabase, {
      empresaId,
      clienteId,
      esDigital: digital,
      productoIds: lineasConProducto.map((l) => l.producto_id),
    });
    lineasConPrecio = lineasConProducto.map((l) => ({
      ...l,
      precio_unitario: precios.get(l.producto_id) ?? l.precio_unitario,
    }));
  }

  const lineas = lineasConPrecio.map((l) => ({
    ...l,
    subtotal: Math.round(l.cantidad * l.precio_unitario * 100) / 100,
  }));

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

// Un pedido solo se puede editar mientras está pendiente de confirmación
// — una vez que avanza (producción, reparto, venta) ya hay gente actuando
// sobre esos números y cambiarlos por debajo generaría inconsistencias.
// No hay ajuste de kardex acá porque un pedido, a diferencia de una venta,
// todavía no mueve stock.
export async function updatePedido(id: string, formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await getEmpresaSession(supabase);

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, estado, almacen_id")
    .eq("id", id)
    .single();

  if (!pedido) {
    redirect(`/pedidos?error=${encodeURIComponent("No se encontró el pedido.")}`);
  }

  if (pedido.estado !== "pendiente_confirmacion") {
    redirect(
      `/pedidos/${id}?error=${encodeURIComponent(
        "Solo se puede editar un pedido mientras está pendiente de confirmación.",
      )}`,
    );
  }

  const clienteId = String(formData.get("cliente_id") ?? "");
  const canalPedido = String(formData.get("canal_pedido") ?? "telefono");
  const fechaEntrega = formData.get("fecha_entrega_requerida");
  const moneda = String(formData.get("moneda") ?? "PEN");

  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);
  const precios = formData.getAll("precio_unitario[]").map(Number);
  const unidadesMedidaIds = formData.getAll("unidad_medida_id[]").map(String);

  const lineasConProducto = productoIds
    .map((producto_id, i) => ({
      producto_id,
      cantidad: cantidades[i],
      precio_unitario: precios[i],
      unidad_medida_id: unidadesMedidaIds[i] || null,
    }))
    .filter((l) => l.producto_id);

  if (lineasConProducto.length === 0) {
    redirect(
      `/pedidos/${id}/editar?error=${encodeURIComponent("Agrega al menos un producto al pedido.")}`,
    );
  }

  if (lineasConProducto.some((l) => !(l.cantidad > 0) || !(l.precio_unitario > 0))) {
    redirect(
      `/pedidos/${id}/editar?error=${encodeURIComponent("Cada producto debe tener una cantidad y un precio unitario mayores a 0.")}`,
    );
  }

  if (lineasConProducto.some((l) => !l.unidad_medida_id)) {
    redirect(
      `/pedidos/${id}/editar?error=${encodeURIComponent("Selecciona la unidad de medida de cada producto.")}`,
    );
  }

  const productoIdsUnicos = new Set(lineasConProducto.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineasConProducto.length) {
    redirect(
      `/pedidos/${id}/editar?error=${encodeURIComponent("Hay un producto repetido en el pedido. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  let lineasConPrecio = lineasConProducto;
  if (await preciosBloqueados(supabase, empresaId)) {
    const digital = await esAlmacenDigital(supabase, pedido.almacen_id);
    const precios = await resolverPrecios(supabase, {
      empresaId,
      clienteId,
      esDigital: digital,
      productoIds: lineasConProducto.map((l) => l.producto_id),
    });
    lineasConPrecio = lineasConProducto.map((l) => ({
      ...l,
      precio_unitario: precios.get(l.producto_id) ?? l.precio_unitario,
    }));
  }

  const lineas = lineasConPrecio.map((l) => ({
    ...l,
    subtotal: Math.round(l.cantidad * l.precio_unitario * 100) / 100,
  }));

  const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);

  const { error: deleteError } = await supabase
    .from("pedido_detalle")
    .delete()
    .eq("pedido_id", id);

  if (deleteError) {
    redirect(`/pedidos/${id}/editar?error=${encodeURIComponent(deleteError.message)}`);
  }

  const { error: detalleError } = await supabase
    .from("pedido_detalle")
    .insert(lineas.map((l) => ({ ...l, pedido_id: id })));

  if (detalleError) {
    redirect(`/pedidos/${id}/editar?error=${encodeURIComponent(detalleError.message)}`);
  }

  const { error: updateError } = await supabase
    .from("pedidos")
    .update({
      cliente_id: clienteId,
      canal_pedido: canalPedido,
      fecha_entrega_requerida: fechaEntrega || null,
      moneda,
      total,
    })
    .eq("id", id);

  if (updateError) {
    redirect(`/pedidos/${id}/editar?error=${encodeURIComponent(updateError.message)}`);
  }

  revalidatePath(`/pedidos/${id}`);
  revalidatePath("/pedidos");
  redirect(`/pedidos/${id}`);
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

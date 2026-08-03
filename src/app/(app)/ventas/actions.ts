"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";

export async function createVenta(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const pedidoId = String(formData.get("pedido_id") ?? "");
  const moneda = String(formData.get("moneda") ?? "PEN");
  const tipoCambio = Number(formData.get("tipo_cambio_aplicado") ?? 1);

  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .select("id, cliente_id")
    .eq("id", pedidoId)
    .single();

  if (pedidoError || !pedido) {
    redirect(
      `/ventas/nueva?error=${encodeURIComponent("El pedido seleccionado no existe.")}`,
    );
  }

  const detalleIds = formData.getAll("pedido_detalle_id[]").map(String);
  const cantidadesEntregadas = formData.getAll("cantidad_entregada[]").map(Number);
  const precios = formData.getAll("precio_unitario[]").map(Number);
  const motivos = formData.getAll("motivo[]").map(String);
  const tiposDevolucion = formData.getAll("tipo_devolucion[]").map(String);

  const { data: pedidoDetalle } = await supabase
    .from("pedido_detalle")
    .select("id, producto_id, cantidad")
    .in("id", detalleIds);

  const lineas = detalleIds
    .map((detalleId, i) => {
      const original = pedidoDetalle?.find((d) => d.id === detalleId);
      if (!original) return null;

      const cantidadEntregada = cantidadesEntregadas[i] ?? 0;
      const precioUnitario = precios[i] ?? 0;

      return {
        producto_id: original.producto_id as string,
        cantidad: original.cantidad as number,
        cantidad_entregada: cantidadEntregada,
        precio_unitario: precioUnitario,
        subtotal: Math.round(cantidadEntregada * precioUnitario * 100) / 100,
        motivo: motivos[i] || null,
        tipo_devolucion: tiposDevolucion[i] || "otro",
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (lineas.length === 0) {
    redirect(
      `/ventas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent("No hay líneas válidas para registrar la venta.")}`,
    );
  }

  const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);

  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      empresa_id: empresaId,
      pedido_id: pedidoId,
      cliente_id: pedido.cliente_id,
      moneda,
      tipo_cambio_aplicado: tipoCambio,
      total,
    })
    .select("id")
    .single();

  if (ventaError || !venta) {
    redirect(
      `/ventas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent(ventaError?.message ?? "No se pudo registrar la venta.")}`,
    );
  }

  for (const linea of lineas) {
    const { data: ventaDetalle, error: detalleError } = await supabase
      .from("venta_detalle")
      .insert({
        venta_id: venta.id,
        producto_id: linea.producto_id,
        cantidad: linea.cantidad,
        cantidad_entregada: linea.cantidad_entregada,
        precio_unitario: linea.precio_unitario,
        subtotal: linea.subtotal,
      })
      .select("id")
      .single();

    if (detalleError || !ventaDetalle) continue;

    const diferencia =
      Math.round((linea.cantidad - linea.cantidad_entregada) * 100) / 100;

    if (diferencia > 0) {
      await supabase.from("devoluciones").insert({
        venta_detalle_id: ventaDetalle.id,
        cantidad: diferencia,
        motivo: linea.motivo,
        tipo: linea.tipo_devolucion,
        usuario_id: userId,
      });
    }
  }

  await supabase.from("pedidos").update({ estado: "entregado" }).eq("id", pedidoId);

  // Amarra los anticipos sueltos del pedido (cobranzas sin venta_id) a la
  // venta recién generada. tipo_pago se mantiene en "anticipo": describe
  // cuándo se cobró (antes de la venta), no a qué venta quedó amarrado.
  await supabase
    .from("cobranzas")
    .update({ venta_id: venta.id })
    .eq("pedido_id", pedidoId)
    .is("venta_id", null);

  revalidatePath("/ventas");
  revalidatePath("/pedidos");
  revalidatePath("/cobranzas");
  revalidatePath(`/pedidos/${pedidoId}`);
  redirect(`/ventas/${venta.id}`);
}

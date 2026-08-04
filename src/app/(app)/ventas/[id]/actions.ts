"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { registrarMovimientosKardex } from "@/utils/supabase/kardex";
import { registrarAuditoria, TIPO_AUDITORIA } from "@/utils/supabase/auditoria";
import { getSaldoVenta } from "@/utils/supabase/ventas";

export async function updateVentaDetalle(ventaId: string, formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .select("id, total, moneda, estado")
    .eq("id", ventaId)
    .single();

  if (ventaError || !venta) {
    redirect(`/ventas/${ventaId}?error=${encodeURIComponent("No se encontró la venta.")}`);
  }

  if (venta.estado === "anulada") {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("Esta venta está anulada y no se puede editar.")}`,
    );
  }

  const saldoActual = await getSaldoVenta(supabase, ventaId, venta.total);
  if (saldoActual <= 0) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("No se puede editar una venta que ya está completamente pagada.")}`,
    );
  }

  const { data: detalleOriginal } = await supabase
    .from("venta_detalle")
    .select("id, producto_id, cantidad, cantidad_entregada, precio_unitario, productos(nombre)")
    .eq("venta_id", ventaId);

  const lineaIds = formData.getAll("linea_id[]").map(String);
  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);
  const precios = formData.getAll("precio_unitario[]").map(Number);

  const enviadas = lineaIds.map((id, i) => ({
    id: id || null,
    producto_id: productoIds[i],
    cantidad: cantidades[i],
    precio_unitario: precios[i],
  }));

  const idsEnviados = new Set(enviadas.filter((l) => l.id).map((l) => l.id));
  const lineasQuitadas = (detalleOriginal ?? []).filter((d) => !idsEnviados.has(d.id));
  const lineasNuevas = enviadas.filter((l) => !l.id && l.producto_id && l.cantidad > 0);
  const lineasModificadas = enviadas.filter((l) => {
    if (!l.id) return false;
    const original = detalleOriginal?.find((d) => d.id === l.id);
    if (!original) return false;
    return (
      original.cantidad_entregada !== l.cantidad ||
      original.precio_unitario !== l.precio_unitario
    );
  });

  const nuevoTotal =
    Math.round(
      enviadas
        .filter((l) => l.producto_id && l.cantidad > 0)
        .reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0) * 100,
    ) / 100;

  const cobrado = Math.round((venta.total - saldoActual) * 100) / 100;
  if (nuevoTotal < cobrado) {
    redirect(
      `/ventas/${ventaId}/editar?error=${encodeURIComponent(
        `El nuevo importe (${nuevoTotal.toFixed(2)}) no puede ser menor a lo ya cobrado (${cobrado.toFixed(2)}).`,
      )}`,
    );
  }

  const productoIdsInvolucrados = [
    ...new Set([
      ...lineasQuitadas.map((l) => l.producto_id),
      ...lineasNuevas.map((l) => l.producto_id),
      ...lineasModificadas.map((l) => l.producto_id),
    ]),
  ];

  const [{ data: productosInfo }, { data: almacen }] = await Promise.all([
    productoIdsInvolucrados.length > 0
      ? supabase
          .from("productos")
          .select("id, nombre, control_inventario")
          .in("id", productoIdsInvolucrados)
      : Promise.resolve({ data: [] as { id: string; nombre: string; control_inventario: boolean }[] }),
    supabase.from("almacenes").select("id").eq("activo", true).limit(1).maybeSingle(),
  ]);

  const movimientosKardex: Parameters<typeof registrarMovimientosKardex>[3] = [];

  // Líneas quitadas: se borran y se revierte su salida de stock.
  for (const linea of lineasQuitadas) {
    await supabase.from("venta_detalle").delete().eq("id", linea.id);

    const producto = productosInfo?.find((p) => p.id === linea.producto_id);
    const productoNombre =
      (linea.productos as unknown as { nombre: string } | null)?.nombre ?? null;

    if (producto?.control_inventario && almacen && linea.cantidad_entregada > 0) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: almacen.id,
        tipoMovimiento: "ajuste",
        cantidad: linea.cantidad_entregada,
        referenciaId: linea.id,
      });
    }

    await registrarAuditoria(supabase, {
      empresaId,
      usuarioId: userId,
      entidad: "venta",
      entidadId: ventaId,
      tipoMovimiento: TIPO_AUDITORIA.ventaQuitarProducto,
      productoId: linea.producto_id,
      productoNombre,
      cantidad: linea.cantidad_entregada,
      precioUnitario: linea.precio_unitario,
      monto: Math.round(linea.cantidad_entregada * linea.precio_unitario * 100) / 100,
      detalle: "Producto quitado de la venta.",
    });
  }

  // Líneas nuevas.
  for (const linea of lineasNuevas) {
    const subtotal = Math.round(linea.cantidad * linea.precio_unitario * 100) / 100;
    const { data: nuevaLinea } = await supabase
      .from("venta_detalle")
      .insert({
        venta_id: ventaId,
        producto_id: linea.producto_id,
        cantidad: linea.cantidad,
        cantidad_entregada: linea.cantidad,
        precio_unitario: linea.precio_unitario,
        subtotal,
      })
      .select("id")
      .single();

    const producto = productosInfo?.find((p) => p.id === linea.producto_id);

    if (producto?.control_inventario && almacen) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: almacen.id,
        tipoMovimiento: "venta",
        cantidad: -linea.cantidad,
        referenciaId: nuevaLinea?.id ?? null,
      });
    }

    await registrarAuditoria(supabase, {
      empresaId,
      usuarioId: userId,
      entidad: "venta",
      entidadId: ventaId,
      tipoMovimiento: TIPO_AUDITORIA.ventaAgregarProducto,
      productoId: linea.producto_id,
      productoNombre: producto?.nombre ?? null,
      cantidad: linea.cantidad,
      precioUnitario: linea.precio_unitario,
      monto: subtotal,
      detalle: "Producto agregado a la venta.",
    });
  }

  // Líneas modificadas.
  for (const linea of lineasModificadas) {
    const original = detalleOriginal!.find((d) => d.id === linea.id)!;
    const subtotal = Math.round(linea.cantidad * linea.precio_unitario * 100) / 100;

    await supabase
      .from("venta_detalle")
      .update({
        cantidad_entregada: linea.cantidad,
        precio_unitario: linea.precio_unitario,
        subtotal,
      })
      .eq("id", linea.id);

    const producto = productosInfo?.find((p) => p.id === linea.producto_id);
    const productoNombre =
      (original.productos as unknown as { nombre: string } | null)?.nombre ?? null;
    const deltaCantidad = linea.cantidad - original.cantidad_entregada;

    if (producto?.control_inventario && almacen && deltaCantidad !== 0) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: almacen.id,
        tipoMovimiento: "ajuste",
        cantidad: -deltaCantidad,
        referenciaId: linea.id,
      });
    }

    await registrarAuditoria(supabase, {
      empresaId,
      usuarioId: userId,
      entidad: "venta",
      entidadId: ventaId,
      tipoMovimiento: TIPO_AUDITORIA.ventaModificarProducto,
      productoId: linea.producto_id,
      productoNombre,
      cantidad: linea.cantidad,
      precioUnitario: linea.precio_unitario,
      monto: subtotal,
      detalle: `Cantidad: ${original.cantidad_entregada} → ${linea.cantidad}. Precio unitario: ${original.precio_unitario} → ${linea.precio_unitario}.`,
    });
  }

  await registrarMovimientosKardex(supabase, empresaId, userId, movimientosKardex);

  await supabase.from("ventas").update({ total: nuevoTotal }).eq("id", ventaId);

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  redirect(`/ventas/${ventaId}`);
}

// Anular una venta exige que no queden cobros activos: si hay un pago
// hecho, primero hay que anular ese pago (ver anularCobranza en
// cobranzas/actions.ts) para no perder trazabilidad de dinero ya cobrado
// sobre una venta que deja de existir.
export async function anularVenta(ventaId: string) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, total, moneda, estado, pedido_id")
    .eq("id", ventaId)
    .single();

  if (!venta) redirect("/ventas");

  if (venta.estado === "anulada") {
    redirect(`/ventas/${ventaId}`);
  }

  const { data: cobranzasActivas } = await supabase
    .from("cobranzas")
    .select("id")
    .eq("venta_id", ventaId)
    .eq("estado", "activa");

  if (cobranzasActivas && cobranzasActivas.length > 0) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent(
        "Esta venta tiene cobros activos. Anula primero el/los pago(s) antes de anular la venta.",
      )}`,
    );
  }

  const { data: detalle } = await supabase
    .from("venta_detalle")
    .select("id, producto_id, cantidad_entregada, productos(control_inventario)")
    .eq("venta_id", ventaId);

  const { data: almacen } = await supabase
    .from("almacenes")
    .select("id")
    .eq("activo", true)
    .limit(1)
    .maybeSingle();

  const movimientosKardex: Parameters<typeof registrarMovimientosKardex>[3] = [];
  for (const linea of detalle ?? []) {
    const llevaInventario = (
      linea.productos as unknown as { control_inventario: boolean } | null
    )?.control_inventario;

    if (llevaInventario && almacen && linea.cantidad_entregada > 0) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: almacen.id,
        tipoMovimiento: "ajuste",
        cantidad: linea.cantidad_entregada,
        referenciaId: linea.id,
      });
    }
  }
  await registrarMovimientosKardex(supabase, empresaId, userId, movimientosKardex);

  await supabase.from("ventas").update({ estado: "anulada" }).eq("id", ventaId);

  await registrarAuditoria(supabase, {
    empresaId,
    usuarioId: userId,
    entidad: "venta",
    entidadId: ventaId,
    tipoMovimiento: TIPO_AUDITORIA.ventaAnular,
    monto: venta.total,
    detalle: `Venta anulada (${venta.moneda} ${venta.total}).`,
  });

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/ventas");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  if (venta.pedido_id) revalidatePath(`/pedidos/${venta.pedido_id}`);
  redirect(`/ventas/${ventaId}`);
}

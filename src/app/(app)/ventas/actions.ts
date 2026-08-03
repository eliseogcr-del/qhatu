"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { registrarMovimientoKardex } from "@/utils/supabase/kardex";

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

  const productoIds = [...new Set(lineas.map((l) => l.producto_id))];
  const { data: productosInfo } = await supabase
    .from("productos")
    .select("id, control_inventario")
    .in("id", productoIds);

  const { data: almacen } = await supabase
    .from("almacenes")
    .select("id")
    .eq("activo", true)
    .limit(1)
    .maybeSingle();

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

    const llevaInventario = productosInfo?.find(
      (p) => p.id === linea.producto_id,
    )?.control_inventario;

    if (llevaInventario && almacen) {
      if (linea.cantidad_entregada > 0) {
        await registrarMovimientoKardex(supabase, {
          empresaId,
          productoId: linea.producto_id,
          almacenId: almacen.id,
          tipoMovimiento: "venta",
          cantidad: -linea.cantidad_entregada,
          referenciaId: ventaDetalle.id,
          usuarioId: userId,
        });
      }
      if (diferencia > 0) {
        await registrarMovimientoKardex(supabase, {
          empresaId,
          productoId: linea.producto_id,
          almacenId: almacen.id,
          tipoMovimiento: "merma",
          cantidad: -diferencia,
          referenciaId: ventaDetalle.id,
          usuarioId: userId,
        });
      }
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
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  revalidatePath(`/pedidos/${pedidoId}`);
  redirect(`/ventas/${venta.id}`);
}

// Venta sin pedido previo (ej. cliente que compra en el momento). Crea un
// pedido "directo" ya entregado por debajo para que el resto del sistema
// (saldo/cobros, reparto si hiciera falta) siga funcionando igual que con
// cualquier otro pedido — evita duplicar esa lógica para este caso.
export async function createVentaDirecta(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const clienteId = String(formData.get("cliente_id") ?? "");
  const moneda = String(formData.get("moneda") ?? "PEN");
  const tipoCambio = Number(formData.get("tipo_cambio_aplicado") ?? 1);

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

  if (!clienteId || lineas.length === 0) {
    redirect(
      `/ventas/directa?error=${encodeURIComponent("Selecciona un cliente y agrega al menos un producto.")}`,
    );
  }

  const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      canal_pedido: "directo",
      fecha_entrega_requerida: hoy,
      estado: "entregado",
      moneda,
      total,
      usuario_id: userId,
    })
    .select("id")
    .single();

  if (pedidoError || !pedido) {
    redirect(
      `/ventas/directa?error=${encodeURIComponent(pedidoError?.message ?? "No se pudo registrar la venta.")}`,
    );
  }

  await supabase.from("pedido_detalle").insert(
    lineas.map((l) => ({ ...l, pedido_id: pedido.id })),
  );

  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      empresa_id: empresaId,
      pedido_id: pedido.id,
      cliente_id: clienteId,
      moneda,
      tipo_cambio_aplicado: tipoCambio,
      total,
    })
    .select("id")
    .single();

  if (ventaError || !venta) {
    redirect(
      `/ventas/directa?error=${encodeURIComponent(ventaError?.message ?? "No se pudo registrar la venta.")}`,
    );
  }

  const productoIdsUnicos = [...new Set(lineas.map((l) => l.producto_id))];
  const { data: productosInfo } = await supabase
    .from("productos")
    .select("id, control_inventario")
    .in("id", productoIdsUnicos);

  const { data: almacen } = await supabase
    .from("almacenes")
    .select("id")
    .eq("activo", true)
    .limit(1)
    .maybeSingle();

  for (const linea of lineas) {
    const { data: ventaDetalle } = await supabase
      .from("venta_detalle")
      .insert({
        venta_id: venta.id,
        producto_id: linea.producto_id,
        cantidad: linea.cantidad,
        cantidad_entregada: linea.cantidad,
        precio_unitario: linea.precio_unitario,
        subtotal: linea.subtotal,
      })
      .select("id")
      .single();

    if (!ventaDetalle) continue;

    const llevaInventario = productosInfo?.find(
      (p) => p.id === linea.producto_id,
    )?.control_inventario;

    if (llevaInventario && almacen) {
      await registrarMovimientoKardex(supabase, {
        empresaId,
        productoId: linea.producto_id,
        almacenId: almacen.id,
        tipoMovimiento: "venta",
        cantidad: -linea.cantidad,
        referenciaId: ventaDetalle.id,
        usuarioId: userId,
      });
    }
  }

  revalidatePath("/ventas");
  revalidatePath("/pedidos");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  redirect(`/ventas/${venta.id}`);
}

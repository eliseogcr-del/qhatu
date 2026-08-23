"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession, resolverAlmacenId } from "@/utils/supabase/session";
import { registrarMovimientosKardex, validarStockDisponible } from "@/utils/supabase/kardex";
import { crearNotaVentaAutomatica } from "@/utils/supabase/comprobantes";

export async function createVenta(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const pedidoId = String(formData.get("pedido_id") ?? "");
  const moneda = String(formData.get("moneda") ?? "PEN");
  const tipoCambio = Number(formData.get("tipo_cambio_aplicado") || 1);

  if (!(tipoCambio > 0)) {
    redirect(
      `/ventas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent("El tipo de cambio debe ser mayor a 0.")}`,
    );
  }

  const detalleIds = formData.getAll("pedido_detalle_id[]").map(String);
  const cantidadesEntregadas = formData.getAll("cantidad_entregada[]").map(Number);
  const precios = formData.getAll("precio_unitario[]").map(Number);
  const motivos = formData.getAll("motivo[]").map(String);
  const tiposDevolucion = formData.getAll("tipo_devolucion[]").map(String);

  const [{ data: pedido, error: pedidoError }, { data: pedidoDetalle }] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select("id, cliente_id, almacen_id")
        .eq("id", pedidoId)
        .single(),
      supabase
        .from("pedido_detalle")
        .select("id, producto_id, cantidad, unidad_medida_id")
        .in("id", detalleIds),
    ]);

  if (pedidoError || !pedido) {
    redirect(
      `/ventas/nueva?error=${encodeURIComponent("El pedido seleccionado no existe.")}`,
    );
  }

  const unidadMedidaIdsPedido = [
    ...new Set((pedidoDetalle ?? []).map((d) => d.unidad_medida_id).filter(Boolean)),
  ];
  const { data: unidadesInfo } = await supabase
    .from("unidades_medida")
    .select("id, cantidad")
    .in("id", unidadMedidaIdsPedido as string[]);
  const factorPorUnidad = new Map(
    (unidadesInfo ?? []).map((u) => [u.id, u.cantidad as number]),
  );

  const lineas = detalleIds
    .map((detalleId, i) => {
      const original = pedidoDetalle?.find((d) => d.id === detalleId);
      if (!original) return null;

      const cantidadEntregada = cantidadesEntregadas[i] ?? 0;
      const precioUnitario = precios[i] ?? 0;
      const factor = factorPorUnidad.get(original.unidad_medida_id as string) ?? 1;

      return {
        producto_id: original.producto_id as string,
        cantidad: original.cantidad as number,
        cantidad_entregada: cantidadEntregada,
        cantidad_entregada_base: Math.round(cantidadEntregada * factor * 100) / 100,
        precio_unitario: precioUnitario,
        subtotal: Math.round(cantidadEntregada * precioUnitario * 100) / 100,
        motivo: motivos[i] || null,
        tipo_devolucion: tiposDevolucion[i] || "otro",
        unidad_medida_id: original.unidad_medida_id as string | null,
        factor,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (lineas.length === 0) {
    redirect(
      `/ventas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent("No hay líneas válidas para registrar la venta.")}`,
    );
  }

  if (lineas.some((l) => l.cantidad_entregada > 0 && !(l.precio_unitario > 0))) {
    redirect(
      `/ventas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent("Todo producto con cantidad entregada debe tener un precio unitario mayor a 0.")}`,
    );
  }

  const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);

  const { data: productosInfo } = await supabase
    .from("productos")
    .select("id, nombre, control_inventario")
    .in("id", [...new Set(lineas.map((l) => l.producto_id))]);

  const lineasControladas = lineas
    .filter((l) => productosInfo?.find((p) => p.id === l.producto_id)?.control_inventario)
    .map((l) => ({
      productoId: l.producto_id,
      productoNombre: productosInfo!.find((p) => p.id === l.producto_id)!.nombre,
      cantidad: l.cantidad_entregada_base,
    }));

  const errorStock = await validarStockDisponible(supabase, pedido.almacen_id, lineasControladas);
  if (errorStock) {
    redirect(
      `/ventas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent(errorStock)}`,
    );
  }

  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .insert({
      empresa_id: empresaId,
      pedido_id: pedidoId,
      cliente_id: pedido.cliente_id,
      moneda,
      tipo_cambio_aplicado: tipoCambio,
      total,
      almacen_id: pedido.almacen_id,
    })
    .select("id")
    .single();

  if (ventaError || !venta) {
    redirect(
      `/ventas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent(ventaError?.message ?? "No se pudo registrar la venta.")}`,
    );
  }

  // Toda venta nace con su nota de venta (documento interno, numerado por
  // almacén) — nunca depende de que alguien la pida a mano. Si esto
  // fallara por algún motivo, la venta ya quedó guardada de todas formas.
  await crearNotaVentaAutomatica(supabase, {
    empresaId,
    userId,
    ventaId: venta.id,
    almacenId: pedido.almacen_id,
  });

  // Un solo insert masivo en vez de uno por línea.
  const { data: ventaDetalleRows } = await supabase
    .from("venta_detalle")
    .insert(
      lineas.map((l) => ({
        venta_id: venta.id,
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        cantidad_entregada: l.cantidad_entregada,
        precio_unitario: l.precio_unitario,
        subtotal: l.subtotal,
        unidad_medida_id: l.unidad_medida_id,
      })),
    )
    .select("id");

  const devolucionRows: {
    venta_detalle_id: string;
    cantidad: number;
    motivo: string | null;
    tipo: string;
    usuario_id: string;
  }[] = [];
  const movimientosKardex: Parameters<typeof registrarMovimientosKardex>[3] = [];

  lineas.forEach((linea, i) => {
    const ventaDetalleId = ventaDetalleRows?.[i]?.id;
    if (!ventaDetalleId) return;

    const diferencia =
      Math.round((linea.cantidad - linea.cantidad_entregada) * 100) / 100;

    if (diferencia > 0) {
      devolucionRows.push({
        venta_detalle_id: ventaDetalleId,
        cantidad: diferencia,
        motivo: linea.motivo,
        tipo: linea.tipo_devolucion,
        usuario_id: userId,
      });
    }

    const llevaInventario = productosInfo?.find(
      (p) => p.id === linea.producto_id,
    )?.control_inventario;

    if (llevaInventario) {
      if (linea.cantidad_entregada > 0) {
        movimientosKardex.push({
          productoId: linea.producto_id,
          almacenId: pedido.almacen_id,
          tipoMovimiento: "venta",
          cantidad: -linea.cantidad_entregada_base,
          referenciaId: ventaDetalleId,
        });
      }
      if (diferencia > 0) {
        movimientosKardex.push({
          productoId: linea.producto_id,
          almacenId: pedido.almacen_id,
          tipoMovimiento: "merma",
          cantidad: -Math.round(diferencia * linea.factor * 100) / 100,
          referenciaId: ventaDetalleId,
        });
      }
    }
  });

  await Promise.all([
    devolucionRows.length > 0
      ? supabase.from("devoluciones").insert(devolucionRows)
      : Promise.resolve(),
    registrarMovimientosKardex(supabase, empresaId, userId, movimientosKardex),
    supabase.from("pedidos").update({ estado: "entregado" }).eq("id", pedidoId),
    // Amarra los anticipos sueltos del pedido (cobranzas sin venta_id) a la
    // venta recién generada. tipo_pago se mantiene en "anticipo": describe
    // cuándo se cobró (antes de la venta), no a qué venta quedó amarrado.
    supabase
      .from("cobranzas")
      .update({ venta_id: venta.id })
      .eq("pedido_id", pedidoId)
      .is("venta_id", null),
  ]);

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
  const session = await getEmpresaSession(supabase);
  const { userId, empresaId } = session;

  const almacenId = resolverAlmacenId(session, formData);
  if (!almacenId) {
    redirect(
      `/ventas/directa?error=${encodeURIComponent("Selecciona el almacén/local para esta venta.")}`,
    );
  }

  const clienteId = String(formData.get("cliente_id") ?? "");
  const moneda = String(formData.get("moneda") ?? "PEN");
  const tipoCambio = Number(formData.get("tipo_cambio_aplicado") || 1);

  if (!(tipoCambio > 0)) {
    redirect(`/ventas/directa?error=${encodeURIComponent("El tipo de cambio debe ser mayor a 0.")}`);
  }

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

  if (!clienteId || lineasConProducto.length === 0) {
    redirect(
      `/ventas/directa?error=${encodeURIComponent("Selecciona un cliente y agrega al menos un producto.")}`,
    );
  }

  if (lineasConProducto.some((l) => !(l.cantidad > 0) || !(l.precio_unitario > 0))) {
    redirect(
      `/ventas/directa?error=${encodeURIComponent("Cada producto debe tener una cantidad y un precio unitario mayores a 0.")}`,
    );
  }

  if (lineasConProducto.some((l) => !l.unidad_medida_id)) {
    redirect(
      `/ventas/directa?error=${encodeURIComponent("Selecciona la unidad de medida de cada producto.")}`,
    );
  }

  const { data: unidadesInfo } = await supabase
    .from("unidades_medida")
    .select("id, cantidad")
    .in("id", [...new Set(lineasConProducto.map((l) => l.unidad_medida_id!))]);
  const factorPorUnidad = new Map(
    (unidadesInfo ?? []).map((u) => [u.id, u.cantidad as number]),
  );

  const lineas = lineasConProducto.map((l) => ({
    ...l,
    subtotal: Math.round(l.cantidad * l.precio_unitario * 100) / 100,
    cantidad_base:
      Math.round(l.cantidad * (factorPorUnidad.get(l.unidad_medida_id!) ?? 1) * 100) / 100,
  }));

  const productoIdsUnicos = new Set(lineas.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineas.length) {
    redirect(
      `/ventas/directa?error=${encodeURIComponent("Hay un producto repetido en la venta. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: productosInfo } = await supabase
    .from("productos")
    .select("id, nombre, control_inventario")
    .in("id", [...productoIdsUnicos]);

  const lineasControladas = lineas
    .filter((l) => productosInfo?.find((p) => p.id === l.producto_id)?.control_inventario)
    .map((l) => ({
      productoId: l.producto_id,
      productoNombre: productosInfo!.find((p) => p.id === l.producto_id)!.nombre,
      cantidad: l.cantidad_base,
    }));

  const errorStock = await validarStockDisponible(supabase, almacenId, lineasControladas);
  if (errorStock) {
    redirect(`/ventas/directa?error=${encodeURIComponent(errorStock)}`);
  }

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
      almacen_id: almacenId,
    })
    .select("id")
    .single();

  if (pedidoError || !pedido) {
    redirect(
      `/ventas/directa?error=${encodeURIComponent(pedidoError?.message ?? "No se pudo registrar la venta.")}`,
    );
  }

  const [, { data: venta, error: ventaError }] = await Promise.all([
    supabase.from("pedido_detalle").insert(
      lineas.map((l) => ({
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        subtotal: l.subtotal,
        unidad_medida_id: l.unidad_medida_id,
        pedido_id: pedido.id,
      })),
    ),
    supabase
      .from("ventas")
      .insert({
        empresa_id: empresaId,
        pedido_id: pedido.id,
        cliente_id: clienteId,
        moneda,
        tipo_cambio_aplicado: tipoCambio,
        total,
        almacen_id: almacenId,
      })
      .select("id")
      .single(),
  ]);

  if (ventaError || !venta) {
    redirect(
      `/ventas/directa?error=${encodeURIComponent(ventaError?.message ?? "No se pudo registrar la venta.")}`,
    );
  }

  // Toda venta nace con su nota de venta (documento interno, numerado por
  // almacén) — nunca depende de que alguien la pida a mano.
  await crearNotaVentaAutomatica(supabase, {
    empresaId,
    userId,
    ventaId: venta.id,
    almacenId,
  });

  const { data: ventaDetalleRows } = await supabase
    .from("venta_detalle")
    .insert(
      lineas.map((l) => ({
        venta_id: venta.id,
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        cantidad_entregada: l.cantidad,
        precio_unitario: l.precio_unitario,
        subtotal: l.subtotal,
        unidad_medida_id: l.unidad_medida_id,
      })),
    )
    .select("id");

  const movimientosKardex: Parameters<typeof registrarMovimientosKardex>[3] = [];
  lineas.forEach((linea, i) => {
    const ventaDetalleId = ventaDetalleRows?.[i]?.id;
    if (!ventaDetalleId) return;

    const llevaInventario = productosInfo?.find(
      (p) => p.id === linea.producto_id,
    )?.control_inventario;

    if (llevaInventario) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId,
        tipoMovimiento: "venta",
        cantidad: -linea.cantidad_base,
        referenciaId: ventaDetalleId,
      });
    }
  });

  await registrarMovimientosKardex(supabase, empresaId, userId, movimientosKardex);

  revalidatePath("/ventas");
  revalidatePath("/pedidos");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  redirect(`/ventas/${venta.id}`);
}

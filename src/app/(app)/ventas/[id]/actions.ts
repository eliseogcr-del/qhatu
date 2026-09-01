"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession, requireAdmin } from "@/utils/supabase/session";
import { registrarMovimientosKardex, validarStockDisponible } from "@/utils/supabase/kardex";
import { registrarAuditoria, TIPO_AUDITORIA } from "@/utils/supabase/auditoria";
import { getSaldoVenta } from "@/utils/supabase/ventas";
import { TIPO_AJUSTE_VENTA_LABEL, type TipoAjusteVenta } from "@/lib/ajuste-venta-tipos";
import { preciosBloqueados, resolverPrecios, esAlmacenDigital } from "@/utils/supabase/precios";

export async function updateVentaDetalle(ventaId: string, formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const { data: venta, error: ventaError } = await supabase
    .from("ventas")
    .select("id, total, descuento, moneda, estado, almacen_id, cliente_id")
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

  const saldoActual = await getSaldoVenta(supabase, ventaId, venta.total, venta.descuento);
  if (saldoActual <= 0) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("No se puede editar una venta que ya está completamente pagada.")}`,
    );
  }

  const { data: detalleOriginal } = await supabase
    .from("venta_detalle")
    .select(
      "id, producto_id, cantidad, cantidad_entregada, precio_unitario, unidad_medida_id, productos(nombre)",
    )
    .eq("venta_id", ventaId);

  const lineaIds = formData.getAll("linea_id[]").map(String);
  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);
  const precios = formData.getAll("precio_unitario[]").map(Number);
  const unidadesMedidaIds = formData.getAll("unidad_medida_id[]").map(String);
  const tiposAjuste = formData.getAll("tipo_ajuste[]").map(String);
  const detallesAjuste = formData.getAll("detalle_ajuste[]").map(String);

  let enviadas = lineaIds.map((id, i) => ({
    id: id || null,
    producto_id: productoIds[i],
    cantidad: cantidades[i],
    precio_unitario: precios[i],
    unidad_medida_id: unidadesMedidaIds[i] || null,
    tipoAjuste: tiposAjuste[i] || "",
    detalleAjuste: detallesAjuste[i] || "",
  }));

  const unidadMedidaIdsInvolucradas = [
    ...new Set(
      [
        ...enviadas.map((l) => l.unidad_medida_id),
        ...(detalleOriginal ?? []).map((d) => d.unidad_medida_id),
      ].filter((v): v is string => Boolean(v)),
    ),
  ];
  const { data: unidadesInfo } =
    unidadMedidaIdsInvolucradas.length > 0
      ? await supabase.from("unidades_medida").select("id, cantidad").in("id", unidadMedidaIdsInvolucradas)
      : { data: [] as { id: string; cantidad: number }[] };
  const factorPorUnidad = new Map(
    (unidadesInfo ?? []).map((u) => [u.id, u.cantidad as number]),
  );
  const factorDe = (unidadMedidaId: string | null) =>
    unidadMedidaId ? (factorPorUnidad.get(unidadMedidaId) ?? 1) : 1;

  const productoIdsActivos = enviadas
    .filter((l) => l.producto_id && l.cantidad > 0)
    .map((l) => l.producto_id);
  if (new Set(productoIdsActivos).size !== productoIdsActivos.length) {
    redirect(
      `/ventas/${ventaId}/editar?error=${encodeURIComponent("Hay un producto repetido en la venta. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  if (enviadas.some((l) => l.producto_id && l.cantidad > 0 && !(l.precio_unitario > 0))) {
    redirect(
      `/ventas/${ventaId}/editar?error=${encodeURIComponent("Todo producto con cantidad debe tener un precio unitario mayor a 0.")}`,
    );
  }

  // Las líneas ya existentes conservan su precio guardado (no se tocan
  // acá salvo que la propia línea cambie); una línea nueva sí se recalcula
  // con la misma lógica que la sugirió en el formulario, para no confiar
  // en lo que haya llegado del cliente.
  if (await preciosBloqueados(supabase, empresaId)) {
    const idsNuevos = enviadas
      .filter((l) => !l.id && l.producto_id && l.cantidad > 0)
      .map((l) => l.producto_id);
    if (idsNuevos.length > 0) {
      const digital = await esAlmacenDigital(supabase, venta.almacen_id);
      const precios = await resolverPrecios(supabase, {
        empresaId,
        clienteId: venta.cliente_id,
        esDigital: digital,
        productoIds: idsNuevos,
      });
      enviadas = enviadas.map((l) =>
        !l.id ? { ...l, precio_unitario: precios.get(l.producto_id) ?? l.precio_unitario } : l,
      );
    }
  }

  const idsEnviados = new Set(enviadas.filter((l) => l.id).map((l) => l.id));
  const lineasQuitadas = (detalleOriginal ?? []).filter((d) => !idsEnviados.has(d.id));
  const lineasNuevas = enviadas.filter((l) => !l.id && l.producto_id && l.cantidad > 0);
  const lineasModificadas = enviadas.filter((l) => {
    if (!l.id) return false;
    const original = detalleOriginal?.find((d) => d.id === l.id);
    if (!original) return false;
    return (
      original.cantidad_entregada !== l.cantidad ||
      original.precio_unitario !== l.precio_unitario ||
      original.unidad_medida_id !== l.unidad_medida_id
    );
  });

  // Si una línea baja de cantidad por debajo de lo que decía el pedido
  // original, hay que saber por qué (el producto vuelve a stock, no es
  // merma) — se valida acá, antes de escribir nada.
  for (const linea of lineasModificadas) {
    const original = detalleOriginal!.find((d) => d.id === linea.id)!;
    if (linea.cantidad < original.cantidad && !linea.tipoAjuste) {
      const productoNombre =
        (original.productos as unknown as { nombre: string } | null)?.nombre ?? "el producto";
      redirect(
        `/ventas/${ventaId}/editar?error=${encodeURIComponent(
          `Indica el motivo por el que "${productoNombre}" se redujo por debajo de lo pedido (${original.cantidad}).`,
        )}`,
      );
    }
  }

  const nuevoTotal =
    Math.round(
      enviadas
        .filter((l) => l.producto_id && l.cantidad > 0)
        .reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0) * 100,
    ) / 100;

  const nuevoDescuento = Number(formData.get("descuento") || 0);
  if (!(nuevoDescuento >= 0)) {
    redirect(
      `/ventas/${ventaId}/editar?error=${encodeURIComponent("El descuento no puede ser negativo.")}`,
    );
  }
  if (nuevoDescuento > nuevoTotal) {
    redirect(
      `/ventas/${ventaId}/editar?error=${encodeURIComponent("El descuento no puede ser mayor al total de la venta.")}`,
    );
  }

  const cobrado = Math.round((venta.total - venta.descuento - saldoActual) * 100) / 100;
  const netoAPagar = Math.round((nuevoTotal - nuevoDescuento) * 100) / 100;
  if (netoAPagar < cobrado) {
    redirect(
      `/ventas/${ventaId}/editar?error=${encodeURIComponent(
        `El nuevo importe a pagar (${netoAPagar.toFixed(2)}) no puede ser menor a lo ya cobrado (${cobrado.toFixed(2)}).`,
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

  const { data: productosInfo } = productoIdsInvolucrados.length > 0
    ? await supabase
        .from("productos")
        .select("id, nombre, control_inventario")
        .in("id", productoIdsInvolucrados)
    : { data: [] as { id: string; nombre: string; control_inventario: boolean }[] };

  // Antes de escribir nada: las líneas nuevas y los aumentos de cantidad
  // en líneas modificadas descuentan stock adicional — hay que confirmar
  // que el almacén realmente lo tiene (bajar cantidad, en cambio, devuelve
  // stock y no necesita validarse).
  const lineasQueDescuentan: { productoId: string; productoNombre: string; cantidad: number }[] =
    [];
  for (const linea of lineasNuevas) {
    const producto = productosInfo?.find((p) => p.id === linea.producto_id);
    if (producto?.control_inventario) {
      lineasQueDescuentan.push({
        productoId: linea.producto_id,
        productoNombre: producto.nombre,
        cantidad: linea.cantidad * factorDe(linea.unidad_medida_id),
      });
    }
  }
  for (const linea of lineasModificadas) {
    const original = detalleOriginal!.find((d) => d.id === linea.id)!;
    const baseOriginal = original.cantidad_entregada * factorDe(original.unidad_medida_id);
    const baseNueva = linea.cantidad * factorDe(linea.unidad_medida_id);
    const delta = Math.round((baseNueva - baseOriginal) * 100) / 100;
    if (delta > 0) {
      const producto = productosInfo?.find((p) => p.id === linea.producto_id);
      if (producto?.control_inventario) {
        lineasQueDescuentan.push({
          productoId: linea.producto_id,
          productoNombre: producto.nombre,
          cantidad: delta,
        });
      }
    }
  }

  const errorStock = await validarStockDisponible(
    supabase,
    venta.almacen_id,
    lineasQueDescuentan,
    "Realiza un traslado del producto desde el almacén principal a este almacén antes de guardar los cambios.",
  );
  if (errorStock) {
    redirect(`/ventas/${ventaId}/editar?error=${encodeURIComponent(errorStock)}`);
  }

  const movimientosKardex: Parameters<typeof registrarMovimientosKardex>[3] = [];

  // Líneas quitadas: se borran y se revierte su salida de stock.
  for (const linea of lineasQuitadas) {
    const { error: deleteError } = await supabase
      .from("venta_detalle")
      .delete()
      .eq("id", linea.id);

    if (deleteError) {
      redirect(
        `/ventas/${ventaId}/editar?error=${encodeURIComponent(`No se pudo quitar el producto: ${deleteError.message}`)}`,
      );
    }

    const producto = productosInfo?.find((p) => p.id === linea.producto_id);
    const productoNombre =
      (linea.productos as unknown as { nombre: string } | null)?.nombre ?? null;

    if (producto?.control_inventario && linea.cantidad_entregada > 0) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: venta.almacen_id,
        tipoMovimiento: "ajuste",
        cantidad: linea.cantidad_entregada * factorDe(linea.unidad_medida_id),
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
        unidad_medida_id: linea.unidad_medida_id,
        subtotal,
      })
      .select("id")
      .single();

    const producto = productosInfo?.find((p) => p.id === linea.producto_id);

    if (producto?.control_inventario) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: venta.almacen_id,
        tipoMovimiento: "venta",
        cantidad: -(linea.cantidad * factorDe(linea.unidad_medida_id)),
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

    const { error: updateError } = await supabase
      .from("venta_detalle")
      .update({
        cantidad_entregada: linea.cantidad,
        precio_unitario: linea.precio_unitario,
        unidad_medida_id: linea.unidad_medida_id,
        subtotal,
      })
      .eq("id", linea.id);

    if (updateError) {
      redirect(
        `/ventas/${ventaId}/editar?error=${encodeURIComponent(`No se pudo modificar el producto: ${updateError.message}`)}`,
      );
    }

    const producto = productosInfo?.find((p) => p.id === linea.producto_id);
    const productoNombre =
      (original.productos as unknown as { nombre: string } | null)?.nombre ?? null;
    const baseOriginal = original.cantidad_entregada * factorDe(original.unidad_medida_id);
    const baseNueva = linea.cantidad * factorDe(linea.unidad_medida_id);
    const deltaBase = Math.round((baseNueva - baseOriginal) * 100) / 100;

    // Si la nueva cantidad quedó por debajo de lo pedido, el motivo ya se
    // validó arriba — acá solo se arma el texto para dejarlo en el
    // kardex (vuelve a stock, no es merma) y en la auditoría.
    const esReduccionBajoPedido = linea.cantidad < original.cantidad;
    const motivoTexto = esReduccionBajoPedido
      ? `${TIPO_AJUSTE_VENTA_LABEL[linea.tipoAjuste as TipoAjusteVenta] ?? linea.tipoAjuste}${
          linea.detalleAjuste ? ` — ${linea.detalleAjuste}` : ""
        }`
      : null;

    if (producto?.control_inventario && deltaBase !== 0) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: venta.almacen_id,
        tipoMovimiento: "ajuste",
        cantidad: -deltaBase,
        referenciaId: linea.id,
        detalle: motivoTexto,
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
      detalle: `Cantidad: ${original.cantidad_entregada} → ${linea.cantidad}. Precio unitario: ${original.precio_unitario} → ${linea.precio_unitario}.${
        original.unidad_medida_id !== linea.unidad_medida_id ? " Unidad de medida modificada." : ""
      }${
        motivoTexto ? ` Motivo: ${motivoTexto}.` : ""
      }`,
    });
  }

  await registrarMovimientosKardex(supabase, empresaId, userId, movimientosKardex);

  await supabase
    .from("ventas")
    .update({ total: nuevoTotal, descuento: nuevoDescuento })
    .eq("id", ventaId);

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
  const { userId, empresaId } = await requireAdmin(supabase);

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, total, moneda, estado, pedido_id, almacen_id")
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
    .select(
      "id, producto_id, cantidad_entregada, unidad_medida_id, productos(control_inventario)",
    )
    .eq("venta_id", ventaId);

  const unidadMedidaIds = [
    ...new Set((detalle ?? []).map((d) => d.unidad_medida_id).filter(Boolean)),
  ];
  const { data: unidadesInfo } =
    unidadMedidaIds.length > 0
      ? await supabase.from("unidades_medida").select("id, cantidad").in("id", unidadMedidaIds as string[])
      : { data: [] as { id: string; cantidad: number }[] };
  const factorPorUnidad = new Map(
    (unidadesInfo ?? []).map((u) => [u.id, u.cantidad as number]),
  );

  const movimientosKardex: Parameters<typeof registrarMovimientosKardex>[3] = [];
  for (const linea of detalle ?? []) {
    const llevaInventario = (
      linea.productos as unknown as { control_inventario: boolean } | null
    )?.control_inventario;

    if (llevaInventario && linea.cantidad_entregada > 0) {
      const factor = linea.unidad_medida_id
        ? (factorPorUnidad.get(linea.unidad_medida_id) ?? 1)
        : 1;
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: venta.almacen_id,
        tipoMovimiento: "ajuste",
        cantidad: linea.cantidad_entregada * factor,
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

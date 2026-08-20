"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireLogisticaOAdmin } from "@/utils/supabase/session";
import { registrarMovimientosKardex, validarStockDisponible } from "@/utils/supabase/kardex";
import { registrarAuditoria, TIPO_AUDITORIA } from "@/utils/supabase/auditoria";

// Lo que la propia empresa elabora en su almacén — a diferencia de compras
// (proveedor externo) o abastecimiento en campo (recogido en ruta), esto
// suma directo al inventario del almacén elegido con un movimiento de
// kardex "produccion".
export async function createProduccion(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await requireLogisticaOAdmin(supabase);

  const almacenId = String(formData.get("almacen_id") ?? "");
  const nota = String(formData.get("nota") ?? "").trim() || null;

  if (!almacenId) {
    redirect(`/produccion/nuevo?error=${encodeURIComponent("Selecciona el almacén.")}`);
  }

  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);

  const lineasConProducto = productoIds
    .map((producto_id, i) => ({ producto_id, cantidad: cantidades[i] }))
    .filter((l) => l.producto_id);

  if (lineasConProducto.length === 0) {
    redirect(`/produccion/nuevo?error=${encodeURIComponent("Agrega al menos un producto.")}`);
  }

  if (lineasConProducto.some((l) => !(l.cantidad > 0))) {
    redirect(
      `/produccion/nuevo?error=${encodeURIComponent("Cada producto debe tener una cantidad mayor a 0.")}`,
    );
  }

  const productoIdsUnicos = new Set(lineasConProducto.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineasConProducto.length) {
    redirect(
      `/produccion/nuevo?error=${encodeURIComponent("Hay un producto repetido. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  const { data: produccion, error: produccionError } = await supabase
    .from("producciones")
    .insert({ empresa_id: empresaId, almacen_id: almacenId, usuario_id: userId, nota })
    .select("id")
    .single();

  if (produccionError || !produccion) {
    redirect(
      `/produccion/nuevo?error=${encodeURIComponent(produccionError?.message ?? "No se pudo registrar la producción.")}`,
    );
  }

  const { data: detalleRows, error: detalleError } = await supabase
    .from("produccion_detalle")
    .insert(
      lineasConProducto.map((l) => ({
        produccion_id: produccion.id,
        producto_id: l.producto_id,
        cantidad: l.cantidad,
      })),
    )
    .select("id, producto_id, cantidad");

  if (detalleError || !detalleRows) {
    redirect(
      `/produccion/nuevo?error=${encodeURIComponent(detalleError?.message ?? "No se pudo registrar el detalle.")}`,
    );
  }

  const { data: productosInfo } = await supabase
    .from("productos")
    .select("id, control_inventario")
    .in("id", [...productoIdsUnicos]);

  const movimientos: Parameters<typeof registrarMovimientosKardex>[3] = [];
  for (const row of detalleRows) {
    const llevaInventario = productosInfo?.find(
      (p) => p.id === row.producto_id,
    )?.control_inventario;
    if (!llevaInventario) continue;

    movimientos.push({
      productoId: row.producto_id,
      almacenId,
      tipoMovimiento: "produccion",
      cantidad: row.cantidad,
      referenciaId: row.id,
      detalle: nota,
    });
  }

  await registrarMovimientosKardex(supabase, empresaId, userId, movimientos);

  revalidatePath("/produccion");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  redirect("/produccion");
}

// Corrige cantidad y/o producto de una producción ya guardada. El kardex
// nunca se reescribe (es inmutable) — cada corrección inserta un
// movimiento de ajuste nuevo con el delta, y queda su propio rastro en
// auditoría (a diferencia de crear, que no se audita).
export async function updateProduccionDetalle(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await requireLogisticaOAdmin(supabase);

  const produccionId = String(formData.get("produccion_id") ?? "");

  const { data: produccion, error: produccionError } = await supabase
    .from("producciones")
    .select("id, almacen_id")
    .eq("id", produccionId)
    .single();

  if (produccionError || !produccion) {
    redirect(`/produccion?error=${encodeURIComponent("No se encontró la producción.")}`);
  }

  const { data: detalleOriginal } = await supabase
    .from("produccion_detalle")
    .select("id, producto_id, cantidad, productos(nombre)")
    .eq("produccion_id", produccionId);

  const detalleIds = formData.getAll("detalle_id[]").map(String);
  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);

  const enviadas = detalleIds
    .map((id, i) => ({
      id: id || null,
      producto_id: productoIds[i],
      cantidad: cantidades[i],
    }))
    .filter((l) => l.producto_id);

  if (enviadas.some((l) => !(l.cantidad > 0))) {
    redirect(
      `/produccion/${produccionId}/editar?error=${encodeURIComponent("Cada producto debe tener una cantidad mayor a 0.")}`,
    );
  }

  const productoIdsUnicos = new Set(enviadas.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== enviadas.length) {
    redirect(
      `/produccion/${produccionId}/editar?error=${encodeURIComponent("Hay un producto repetido. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  const idsEnviados = new Set(enviadas.filter((l) => l.id).map((l) => l.id));
  const lineasQuitadas = (detalleOriginal ?? []).filter((d) => !idsEnviados.has(d.id));
  const lineasNuevas = enviadas.filter((l) => !l.id);
  const lineasModificadas = enviadas.filter((l) => {
    if (!l.id) return false;
    const original = detalleOriginal?.find((d) => d.id === l.id);
    if (!original) return false;
    return original.producto_id !== l.producto_id || original.cantidad !== l.cantidad;
  });

  const productoIdsInvolucrados = [
    ...new Set([
      ...lineasQuitadas.map((l) => l.producto_id),
      ...lineasNuevas.map((l) => l.producto_id),
      ...lineasModificadas.flatMap((l) => {
        const original = detalleOriginal!.find((d) => d.id === l.id)!;
        return [original.producto_id, l.producto_id];
      }),
    ]),
  ];

  const { data: productosInfo } =
    productoIdsInvolucrados.length > 0
      ? await supabase
          .from("productos")
          .select("id, nombre, control_inventario")
          .in("id", productoIdsInvolucrados)
      : { data: [] as { id: string; nombre: string; control_inventario: boolean }[] };

  // Antes de escribir nada: cualquier reducción de stock (línea quitada,
  // cambio de producto que deja el anterior en 0, o baja de cantidad) debe
  // confirmar que el almacén realmente tiene ese saldo — si ya se usó ese
  // stock en otro lado, no se puede simplemente restarlo.
  const lineasQueDescuentan: { productoId: string; productoNombre: string; cantidad: number }[] =
    [];

  for (const linea of lineasQuitadas) {
    const producto = productosInfo?.find((p) => p.id === linea.producto_id);
    if (producto?.control_inventario) {
      lineasQueDescuentan.push({
        productoId: linea.producto_id,
        productoNombre: producto.nombre,
        cantidad: linea.cantidad,
      });
    }
  }
  for (const linea of lineasModificadas) {
    const original = detalleOriginal!.find((d) => d.id === linea.id)!;
    if (original.producto_id !== linea.producto_id) {
      const productoOriginal = productosInfo?.find((p) => p.id === original.producto_id);
      if (productoOriginal?.control_inventario) {
        lineasQueDescuentan.push({
          productoId: original.producto_id,
          productoNombre: productoOriginal.nombre,
          cantidad: original.cantidad,
        });
      }
    } else {
      const delta = Math.round((linea.cantidad - original.cantidad) * 100) / 100;
      if (delta < 0) {
        const producto = productosInfo?.find((p) => p.id === linea.producto_id);
        if (producto?.control_inventario) {
          lineasQueDescuentan.push({
            productoId: linea.producto_id,
            productoNombre: producto.nombre,
            cantidad: -delta,
          });
        }
      }
    }
  }

  const errorStock = await validarStockDisponible(
    supabase,
    produccion.almacen_id,
    lineasQueDescuentan,
  );
  if (errorStock) {
    redirect(`/produccion/${produccionId}/editar?error=${encodeURIComponent(errorStock)}`);
  }

  const movimientosKardex: Parameters<typeof registrarMovimientosKardex>[3] = [];

  for (const linea of lineasQuitadas) {
    const { error: deleteError } = await supabase
      .from("produccion_detalle")
      .delete()
      .eq("id", linea.id);

    if (deleteError) {
      redirect(
        `/produccion/${produccionId}/editar?error=${encodeURIComponent(`No se pudo quitar el producto: ${deleteError.message}`)}`,
      );
    }

    const producto = productosInfo?.find((p) => p.id === linea.producto_id);
    const productoNombre =
      (linea.productos as unknown as { nombre: string } | null)?.nombre ?? null;

    if (producto?.control_inventario) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: produccion.almacen_id,
        tipoMovimiento: "ajuste",
        cantidad: -linea.cantidad,
        referenciaId: linea.id,
        detalle: "Producto quitado de la producción.",
      });
    }

    await registrarAuditoria(supabase, {
      empresaId,
      usuarioId: userId,
      entidad: "produccion",
      entidadId: produccionId,
      tipoMovimiento: TIPO_AUDITORIA.produccionQuitarProducto,
      productoId: linea.producto_id,
      productoNombre,
      cantidad: linea.cantidad,
      detalle: "Producto quitado de la producción.",
    });
  }

  for (const linea of lineasNuevas) {
    const { data: nuevaLinea } = await supabase
      .from("produccion_detalle")
      .insert({
        produccion_id: produccionId,
        producto_id: linea.producto_id,
        cantidad: linea.cantidad,
      })
      .select("id")
      .single();

    const producto = productosInfo?.find((p) => p.id === linea.producto_id);

    if (producto?.control_inventario) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: produccion.almacen_id,
        tipoMovimiento: "produccion",
        cantidad: linea.cantidad,
        referenciaId: nuevaLinea?.id ?? null,
        detalle: "Producto agregado a la producción.",
      });
    }

    await registrarAuditoria(supabase, {
      empresaId,
      usuarioId: userId,
      entidad: "produccion",
      entidadId: produccionId,
      tipoMovimiento: TIPO_AUDITORIA.produccionAgregarProducto,
      productoId: linea.producto_id,
      productoNombre: producto?.nombre ?? null,
      cantidad: linea.cantidad,
      detalle: "Producto agregado a la producción.",
    });
  }

  for (const linea of lineasModificadas) {
    const original = detalleOriginal!.find((d) => d.id === linea.id)!;
    const cambioDeProducto = original.producto_id !== linea.producto_id;

    const { error: updateError } = await supabase
      .from("produccion_detalle")
      .update({ producto_id: linea.producto_id, cantidad: linea.cantidad })
      .eq("id", linea.id);

    if (updateError) {
      redirect(
        `/produccion/${produccionId}/editar?error=${encodeURIComponent(`No se pudo modificar el producto: ${updateError.message}`)}`,
      );
    }

    const productoOriginalNombre =
      (original.productos as unknown as { nombre: string } | null)?.nombre ?? null;
    const productoNuevo = productosInfo?.find((p) => p.id === linea.producto_id);

    if (cambioDeProducto) {
      const productoOriginalInfo = productosInfo?.find((p) => p.id === original.producto_id);
      if (productoOriginalInfo?.control_inventario) {
        movimientosKardex.push({
          productoId: original.producto_id,
          almacenId: produccion.almacen_id,
          tipoMovimiento: "ajuste",
          cantidad: -original.cantidad,
          referenciaId: linea.id,
          detalle: `Se cambió por "${productoNuevo?.nombre ?? linea.producto_id}".`,
        });
      }
      if (productoNuevo?.control_inventario) {
        movimientosKardex.push({
          productoId: linea.producto_id,
          almacenId: produccion.almacen_id,
          tipoMovimiento: "produccion",
          cantidad: linea.cantidad,
          referenciaId: linea.id,
          detalle: `Reemplazó a "${productoOriginalNombre ?? original.producto_id}".`,
        });
      }
    } else {
      const delta = Math.round((linea.cantidad - original.cantidad) * 100) / 100;
      if (delta !== 0 && productoNuevo?.control_inventario) {
        movimientosKardex.push({
          productoId: linea.producto_id,
          almacenId: produccion.almacen_id,
          tipoMovimiento: "ajuste",
          cantidad: delta,
          referenciaId: linea.id,
          detalle: `Corrección de cantidad: ${original.cantidad} → ${linea.cantidad}.`,
        });
      }
    }

    await registrarAuditoria(supabase, {
      empresaId,
      usuarioId: userId,
      entidad: "produccion",
      entidadId: produccionId,
      tipoMovimiento: TIPO_AUDITORIA.produccionModificarProducto,
      productoId: linea.producto_id,
      productoNombre: productoNuevo?.nombre ?? null,
      cantidad: linea.cantidad,
      detalle: cambioDeProducto
        ? `Producto: "${productoOriginalNombre}" → "${productoNuevo?.nombre}". Cantidad: ${original.cantidad} → ${linea.cantidad}.`
        : `Cantidad: ${original.cantidad} → ${linea.cantidad}.`,
    });
  }

  await registrarMovimientosKardex(supabase, empresaId, userId, movimientosKardex);

  revalidatePath("/produccion");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  revalidatePath("/auditoria");
  redirect("/produccion");
}

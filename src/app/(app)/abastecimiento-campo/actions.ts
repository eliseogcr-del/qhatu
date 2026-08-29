"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession, resolverAlmacenId } from "@/utils/supabase/session";
import { registrarMovimientosKardex } from "@/utils/supabase/kardex";
import { costoBaseDesdeReferencial } from "@/utils/supabase/compras";

// Registro de mercadería que un vendedor recoge de un proveedor mientras
// está en ruta, sin precio ni documento de compra — solo qué y cuánto.
// Siempre suma al almacén del propio vendedor, así que a diferencia de
// traslados no hace falta el cliente admin: la escritura de kardex/
// inventario cae dentro de lo que su propia sesión ya puede tocar.
export async function createAbastecimientoCampo(formData: FormData) {
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);
  const { userId, empresaId } = session;

  const almacenId = resolverAlmacenId(session, formData);
  if (!almacenId) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent("Selecciona el almacén al que va esta mercadería.")}`,
    );
  }

  const proveedorId = String(formData.get("proveedor_id") ?? "").trim() || null;
  const nota = String(formData.get("nota") ?? "").trim() || null;

  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);
  const unidadesMedidaIds = formData.getAll("unidad_medida_id[]").map(String);

  const lineasConProducto = productoIds
    .map((producto_id, i) => ({
      producto_id,
      cantidad: cantidades[i],
      unidad_medida_id: unidadesMedidaIds[i] || null,
    }))
    .filter((l) => l.producto_id);

  if (lineasConProducto.length === 0) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent("Agrega al menos un producto.")}`,
    );
  }
  if (lineasConProducto.some((l) => !(l.cantidad > 0))) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent("Cada producto debe tener una cantidad mayor a 0.")}`,
    );
  }
  if (lineasConProducto.some((l) => !l.unidad_medida_id)) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent("Selecciona la unidad de medida de cada producto.")}`,
    );
  }

  const productoIdsUnicos = new Set(lineasConProducto.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineasConProducto.length) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent("Hay un producto repetido. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  const { data: unidadesInfo } = await supabase
    .from("unidades_medida")
    .select("id, cantidad")
    .in("id", [...new Set(lineasConProducto.map((l) => l.unidad_medida_id!))]);
  const factorPorUnidad = new Map((unidadesInfo ?? []).map((u) => [u.id, u.cantidad as number]));

  const lineas = lineasConProducto.map((l) => ({
    ...l,
    cantidad_base:
      Math.round(l.cantidad * (factorPorUnidad.get(l.unidad_medida_id!) ?? 1) * 100) / 100,
  }));

  const { data: abastecimiento, error: abastecimientoError } = await supabase
    .from("abastecimientos_campo")
    .insert({
      empresa_id: empresaId,
      almacen_id: almacenId,
      proveedor_id: proveedorId,
      usuario_id: userId,
      nota,
    })
    .select("id")
    .single();

  if (abastecimientoError || !abastecimiento) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent(abastecimientoError?.message ?? "No se pudo registrar el abastecimiento.")}`,
    );
  }

  const { data: detalleRows, error: detalleError } = await supabase
    .from("abastecimiento_campo_detalle")
    .insert(
      lineas.map((l) => ({
        abastecimiento_id: abastecimiento.id,
        producto_id: l.producto_id,
        cantidad: l.cantidad,
        unidad_medida_id: l.unidad_medida_id,
      })),
    )
    .select("id, producto_id");

  if (detalleError || !detalleRows) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent(detalleError?.message ?? "No se pudo registrar el detalle.")}`,
    );
  }

  const cantidadBasePorProducto = new Map(lineas.map((l) => [l.producto_id, l.cantidad_base]));

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
      tipoMovimiento: "abastecimiento_campo",
      cantidad: cantidadBasePorProducto.get(row.producto_id) ?? 0,
      referenciaId: row.id,
      detalle: nota,
    });
  }

  await registrarMovimientosKardex(supabase, empresaId, userId, movimientos);

  // Registro automático e interno de la compra al proveedor: el ingreso
  // del producto ya lo hizo este abastecimiento (kardex incluido), así
  // que esta compra "espejo" nunca vuelve a tocar kardex/inventario —
  // solo deja constancia del costo para cuentas por pagar, pendiente de
  // que Admin/Logística la valide. Nunca bloquea el abastecimiento: si
  // algo sale mal generándola, el abastecimiento ya quedó registrado.
  if (proveedorId) {
    try {
      const { data: productosCosto } = await supabase
        .from("productos")
        .select("id, costo_referencial, unidades_medida(cantidad)")
        .in("id", [...productoIdsUnicos]);

      const lineasCompra = detalleRows.map((row) => {
        const info = productosCosto?.find((p) => p.id === row.producto_id);
        const factorProducto =
          (info?.unidades_medida as unknown as { cantidad: number } | null)?.cantidad ?? null;
        const costoUnitario = costoBaseDesdeReferencial(
          info?.costo_referencial ?? null,
          factorProducto,
        );
        const cantidad = cantidadBasePorProducto.get(row.producto_id) ?? 0;
        return {
          producto_id: row.producto_id,
          cantidad,
          costo_unitario: costoUnitario,
          subtotal: Math.round(costoUnitario * cantidad * 100) / 100,
        };
      });

      const { data: compraAuto, error: compraAutoError } = await supabase
        .from("compras")
        .insert({
          empresa_id: empresaId,
          proveedor_id: proveedorId,
          total: lineasCompra.reduce((acc, l) => acc + l.subtotal, 0),
          usuario_id: userId,
          almacen_id: almacenId,
          origen: "abastecimiento_campo",
          validado: false,
          abastecimiento_id: abastecimiento.id,
        })
        .select("id")
        .single();

      if (!compraAutoError && compraAuto) {
        await supabase.from("compra_detalle").insert(
          lineasCompra.map((l) => ({
            compra_id: compraAuto.id,
            producto_id: l.producto_id,
            cantidad: l.cantidad,
            costo_unitario: l.costo_unitario,
            subtotal: l.subtotal,
          })),
        );
      }
    } catch {
      // best-effort: ver comentario arriba.
    }
  }

  revalidatePath("/abastecimiento-campo");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  revalidatePath("/compras");
  redirect("/abastecimiento-campo");
}

// Corrige un abastecimiento ya registrado (cantidad, producto, o quitar
// una línea) — proveedor y almacén quedan fijos. Emite kardex
// compensatorio ('ajuste') por la diferencia entre lo que había y lo
// nuevo, igual que al editar una venta. Si ya generó su compra espejo
// (createAbastecimientoCampo) y esa compra sigue sin validar, se
// regenera para reflejar los mismos cambios; si ya fue validada por
// Admin/Logística, la edición queda bloqueada.
export async function updateAbastecimientoCampo(id: string, formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const { data: abastecimiento } = await supabase
    .from("abastecimientos_campo")
    .select("id, almacen_id, proveedor_id")
    .eq("id", id)
    .single();

  if (!abastecimiento) redirect("/abastecimiento-campo");

  const { data: compraVinculada } = await supabase
    .from("compras")
    .select("id, validado")
    .eq("abastecimiento_id", id)
    .maybeSingle();

  if (compraVinculada?.validado) {
    redirect(
      `/abastecimiento-campo/${id}/editar?error=${encodeURIComponent(
        "No se puede editar: la compra que generó ya fue validada por Admin/Logística.",
      )}`,
    );
  }

  const nota = String(formData.get("nota") ?? "").trim() || null;
  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);
  const unidadesMedidaIds = formData.getAll("unidad_medida_id[]").map(String);

  const lineasConProducto = productoIds
    .map((producto_id, i) => ({
      producto_id,
      cantidad: cantidades[i],
      unidad_medida_id: unidadesMedidaIds[i] || null,
    }))
    .filter((l) => l.producto_id);

  if (lineasConProducto.length === 0) {
    redirect(
      `/abastecimiento-campo/${id}/editar?error=${encodeURIComponent("Agrega al menos un producto.")}`,
    );
  }
  if (lineasConProducto.some((l) => !(l.cantidad > 0))) {
    redirect(
      `/abastecimiento-campo/${id}/editar?error=${encodeURIComponent("Cada producto debe tener una cantidad mayor a 0.")}`,
    );
  }
  if (lineasConProducto.some((l) => !l.unidad_medida_id)) {
    redirect(
      `/abastecimiento-campo/${id}/editar?error=${encodeURIComponent("Selecciona la unidad de medida de cada producto.")}`,
    );
  }

  const productoIdsUnicos = new Set(lineasConProducto.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineasConProducto.length) {
    redirect(
      `/abastecimiento-campo/${id}/editar?error=${encodeURIComponent(
        "Hay un producto repetido. Cada producto debe aparecer una sola vez.",
      )}`,
    );
  }

  const { data: unidadesInfo } = await supabase
    .from("unidades_medida")
    .select("id, cantidad")
    .in("id", [...new Set(lineasConProducto.map((l) => l.unidad_medida_id!))]);
  const factorPorUnidad = new Map((unidadesInfo ?? []).map((u) => [u.id, u.cantidad as number]));

  const lineasNuevas = lineasConProducto.map((l) => ({
    ...l,
    cantidad_base:
      Math.round(l.cantidad * (factorPorUnidad.get(l.unidad_medida_id!) ?? 1) * 100) / 100,
  }));

  const { data: detalleExistente } = await supabase
    .from("abastecimiento_campo_detalle")
    .select("id, producto_id, cantidad, unidades_medida(cantidad)")
    .eq("abastecimiento_id", id);

  const existentePorProducto = new Map(
    (detalleExistente ?? []).map((l) => [
      l.producto_id,
      {
        id: l.id,
        cantidadBase:
          l.cantidad *
          ((l.unidades_medida as unknown as { cantidad: number } | null)?.cantidad ?? 1),
      },
    ]),
  );

  const aEliminar = [...existentePorProducto.entries()].filter(
    ([productoId]) => !productoIdsUnicos.has(productoId),
  );
  const aActualizar = lineasNuevas.filter((l) => existentePorProducto.has(l.producto_id));
  const aInsertar = lineasNuevas.filter((l) => !existentePorProducto.has(l.producto_id));

  if (aEliminar.length > 0) {
    await supabase
      .from("abastecimiento_campo_detalle")
      .delete()
      .in(
        "id",
        aEliminar.map(([, l]) => l.id),
      );
  }
  await Promise.all(
    aActualizar.map((l) =>
      supabase
        .from("abastecimiento_campo_detalle")
        .update({ cantidad: l.cantidad, unidad_medida_id: l.unidad_medida_id })
        .eq("id", existentePorProducto.get(l.producto_id)!.id),
    ),
  );
  const { data: insertados } =
    aInsertar.length > 0
      ? await supabase
          .from("abastecimiento_campo_detalle")
          .insert(
            aInsertar.map((l) => ({
              abastecimiento_id: id,
              producto_id: l.producto_id,
              cantidad: l.cantidad,
              unidad_medida_id: l.unidad_medida_id,
            })),
          )
          .select("id, producto_id")
      : { data: [] as { id: string; producto_id: string }[] };

  const { data: productosInfo } = await supabase
    .from("productos")
    .select("id, control_inventario")
    .in("id", [...new Set([...existentePorProducto.keys(), ...productoIdsUnicos])]);

  const movimientos: Parameters<typeof registrarMovimientosKardex>[3] = [];
  for (const [productoId, existente] of aEliminar) {
    if (!productosInfo?.find((p) => p.id === productoId)?.control_inventario) continue;
    movimientos.push({
      productoId,
      almacenId: abastecimiento.almacen_id,
      tipoMovimiento: "ajuste",
      cantidad: -existente.cantidadBase,
      referenciaId: existente.id,
      detalle: "Corrección de abastecimiento en campo: línea eliminada",
    });
  }
  for (const l of aActualizar) {
    if (!productosInfo?.find((p) => p.id === l.producto_id)?.control_inventario) continue;
    const delta = l.cantidad_base - existentePorProducto.get(l.producto_id)!.cantidadBase;
    if (delta === 0) continue;
    movimientos.push({
      productoId: l.producto_id,
      almacenId: abastecimiento.almacen_id,
      tipoMovimiento: "ajuste",
      cantidad: delta,
      referenciaId: existentePorProducto.get(l.producto_id)!.id,
      detalle: "Corrección de abastecimiento en campo",
    });
  }
  for (const row of insertados ?? []) {
    if (!productosInfo?.find((p) => p.id === row.producto_id)?.control_inventario) continue;
    const l = aInsertar.find((x) => x.producto_id === row.producto_id)!;
    movimientos.push({
      productoId: row.producto_id,
      almacenId: abastecimiento.almacen_id,
      tipoMovimiento: "ajuste",
      cantidad: l.cantidad_base,
      referenciaId: row.id,
      detalle: "Corrección de abastecimiento en campo: línea agregada",
    });
  }

  await registrarMovimientosKardex(supabase, empresaId, userId, movimientos);

  await supabase.from("abastecimientos_campo").update({ nota }).eq("id", id);

  // La compra espejo (si existe y sigue sin validar) se regenera para
  // reflejar los mismos cambios -- nunca toca kardex/inventario.
  if (compraVinculada) {
    try {
      const { data: productosCosto } = await supabase
        .from("productos")
        .select("id, costo_referencial, unidades_medida(cantidad)")
        .in("id", [...productoIdsUnicos]);

      const lineasCompra = lineasNuevas.map((l) => {
        const info = productosCosto?.find((p) => p.id === l.producto_id);
        const factorProducto =
          (info?.unidades_medida as unknown as { cantidad: number } | null)?.cantidad ?? null;
        const costoUnitario = costoBaseDesdeReferencial(
          info?.costo_referencial ?? null,
          factorProducto,
        );
        return {
          producto_id: l.producto_id,
          cantidad: l.cantidad_base,
          costo_unitario: costoUnitario,
          subtotal: Math.round(costoUnitario * l.cantidad_base * 100) / 100,
        };
      });

      await supabase.from("compra_detalle").delete().eq("compra_id", compraVinculada.id);
      await supabase.from("compra_detalle").insert(
        lineasCompra.map((l) => ({
          compra_id: compraVinculada.id,
          producto_id: l.producto_id,
          cantidad: l.cantidad,
          costo_unitario: l.costo_unitario,
          subtotal: l.subtotal,
        })),
      );
      await supabase
        .from("compras")
        .update({ total: lineasCompra.reduce((acc, l) => acc + l.subtotal, 0) })
        .eq("id", compraVinculada.id);
    } catch {
      // best-effort: la edición del abastecimiento ya quedó guardada.
    }
  }

  revalidatePath("/abastecimiento-campo");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  revalidatePath("/compras");
  redirect("/abastecimiento-campo");
}

import { createClient } from "./server";

// Antes de descontar stock (venta, traslado hacia afuera, etc.) hay que
// confirmar que el almacén realmente tiene esa cantidad — sin esto,
// registrar una venta más grande que lo disponible dejaba el inventario en
// negativo silenciosamente. Solo aplica a productos con control de
// inventario; el resto no tiene fila en `inventario` y no se valida.
export async function validarStockDisponible(
  supabase: Awaited<ReturnType<typeof createClient>>,
  almacenId: string,
  lineas: { productoId: string; productoNombre: string; cantidad: number }[],
): Promise<string | null> {
  if (lineas.length === 0) return null;

  const { data: inventarios } = await supabase
    .from("inventario")
    .select("producto_id, stock_actual")
    .eq("almacen_id", almacenId)
    .in("producto_id", lineas.map((l) => l.productoId));

  const stockPorProducto = new Map(
    (inventarios ?? []).map((i) => [i.producto_id, i.stock_actual]),
  );

  const insuficientes = lineas.filter(
    (l) => l.cantidad > (stockPorProducto.get(l.productoId) ?? 0),
  );

  if (insuficientes.length === 0) return null;

  const detalle = insuficientes
    .map(
      (l) =>
        `${l.productoNombre} (disponible: ${stockPorProducto.get(l.productoId) ?? 0}, solicitado: ${l.cantidad})`,
    )
    .join("; ");

  return `No hay stock suficiente en ese almacén: ${detalle}.`;
}

export async function registrarMovimientoKardex(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    empresaId: string;
    productoId: string;
    almacenId: string;
    tipoMovimiento: string;
    cantidad: number; // signed: positivo = entrada, negativo = salida
    referenciaId?: string | null;
    detalle?: string | null;
    usuarioId: string;
  },
) {
  const { data: inventario } = await supabase
    .from("inventario")
    .select("stock_actual")
    .eq("producto_id", params.productoId)
    .eq("almacen_id", params.almacenId)
    .maybeSingle();

  const saldoAnterior = inventario?.stock_actual ?? 0;
  const saldoResultante = Math.round((saldoAnterior + params.cantidad) * 100) / 100;

  await supabase.from("kardex_movimientos").insert({
    empresa_id: params.empresaId,
    producto_id: params.productoId,
    almacen_id: params.almacenId,
    tipo_movimiento: params.tipoMovimiento,
    cantidad: params.cantidad,
    saldo_resultante: saldoResultante,
    referencia_id: params.referenciaId ?? null,
    detalle: params.detalle ?? null,
    usuario_id: params.usuarioId,
  });

  await supabase.from("inventario").upsert(
    {
      producto_id: params.productoId,
      almacen_id: params.almacenId,
      stock_actual: saldoResultante,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "producto_id,almacen_id" },
  );

  return saldoResultante;
}

// Versión en lote: resuelve N movimientos en 3 round-trips (un select, un
// insert masivo, un upsert masivo) en vez de 3*N — usada donde una sola
// operación (ej. registrar una venta) genera varios movimientos a la vez.
// Los saldos se acumulan en memoria y en el orden del array, así que el
// orden de `movimientos` debe respetar la secuencia real de cada
// producto+almacén (igual que llamar a registrarMovimientoKardex N veces
// seguidas).
export async function registrarMovimientosKardex(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  usuarioId: string,
  movimientos: {
    productoId: string;
    almacenId: string;
    tipoMovimiento: string;
    cantidad: number;
    referenciaId?: string | null;
    detalle?: string | null;
  }[],
) {
  if (movimientos.length === 0) return;

  const key = (productoId: string, almacenId: string) => `${productoId}::${almacenId}`;

  const productoIds = [...new Set(movimientos.map((m) => m.productoId))];
  const almacenIds = [...new Set(movimientos.map((m) => m.almacenId))];

  const { data: inventarios } = await supabase
    .from("inventario")
    .select("producto_id, almacen_id, stock_actual")
    .in("producto_id", productoIds)
    .in("almacen_id", almacenIds);

  const saldos = new Map<string, number>();
  for (const inv of inventarios ?? []) {
    saldos.set(key(inv.producto_id, inv.almacen_id), inv.stock_actual);
  }

  const kardexRows = movimientos.map((m) => {
    const k = key(m.productoId, m.almacenId);
    const saldoResultante =
      Math.round(((saldos.get(k) ?? 0) + m.cantidad) * 100) / 100;
    saldos.set(k, saldoResultante);

    return {
      empresa_id: empresaId,
      producto_id: m.productoId,
      almacen_id: m.almacenId,
      tipo_movimiento: m.tipoMovimiento,
      cantidad: m.cantidad,
      saldo_resultante: saldoResultante,
      referencia_id: m.referenciaId ?? null,
      detalle: m.detalle ?? null,
      usuario_id: usuarioId,
    };
  });

  await supabase.from("kardex_movimientos").insert(kardexRows);

  const inventarioRows = [...saldos.entries()].map(([k, stock]) => {
    const [producto_id, almacen_id] = k.split("::");
    return {
      producto_id,
      almacen_id,
      stock_actual: stock,
      updated_at: new Date().toISOString(),
    };
  });

  await supabase
    .from("inventario")
    .upsert(inventarioRows, { onConflict: "producto_id,almacen_id" });
}

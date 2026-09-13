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
  // Texto extra a agregar al final del mensaje (ej. sugerir un traslado
  // desde el almacén principal) — cada módulo que llama a esto sabe mejor
  // que nadie qué acción de seguimiento tiene sentido para su caso.
  sugerencia?: string,
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

  return `No hay stock suficiente en ese almacén: ${detalle}.${sugerencia ? ` ${sugerencia}` : ""}`;
}

// El saldo se actualiza con una función de Postgres (`registrar_movimiento_kardex`)
// que hace un solo `UPDATE stock = stock + delta` atómico, en vez de "leer
// el stock, calcular el nuevo saldo acá y recién after escribir" — ese
// patrón de dos pasos permitía que dos movimientos casi simultáneos para el
// mismo producto+almacén (doble clic, un reintento, dos pestañas) leyeran
// el mismo stock viejo y uno de los dos se perdiera silenciosamente del
// saldo (confirmado en producción). Con el UPDATE atómico, Postgres
// serializa cualquier escritura concurrente sobre la misma fila y ya no
// hay forma de perder un movimiento por una carrera.
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
  const { data, error } = await supabase.rpc("registrar_movimiento_kardex", {
    p_empresa_id: params.empresaId,
    p_producto_id: params.productoId,
    p_almacen_id: params.almacenId,
    p_tipo_movimiento: params.tipoMovimiento,
    p_cantidad: params.cantidad,
    p_usuario_id: params.usuarioId,
    p_referencia_id: params.referenciaId ?? null,
    p_detalle: params.detalle ?? null,
  });

  if (error) throw new Error(error.message);

  return data as number;
}

// Versión en lote: mismos movimientos, pero resueltos en una sola llamada
// a `registrar_movimientos_kardex`, que aplica cada uno con su propio
// UPDATE atómico dentro de una única transacción — un movimiento a la vez,
// en el orden del array, igual que antes, pero sin la ventana de carrera
// que tenía la versión que acumulaba saldos en memoria del lado de JS.
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

  const { error } = await supabase.rpc("registrar_movimientos_kardex", {
    p_empresa_id: empresaId,
    p_usuario_id: usuarioId,
    p_movimientos: movimientos.map((m) => ({
      productoId: m.productoId,
      almacenId: m.almacenId,
      tipoMovimiento: m.tipoMovimiento,
      cantidad: m.cantidad,
      referenciaId: m.referenciaId ?? null,
      detalle: m.detalle ?? null,
    })),
  });

  if (error) throw new Error(error.message);
}

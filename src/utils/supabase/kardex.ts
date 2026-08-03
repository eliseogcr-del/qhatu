import { createClient } from "./server";

export async function registrarMovimientoKardex(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    empresaId: string;
    productoId: string;
    almacenId: string;
    tipoMovimiento: string;
    cantidad: number; // signed: positivo = entrada, negativo = salida
    referenciaId?: string | null;
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

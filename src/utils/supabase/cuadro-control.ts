import { createClient } from "./server";
import { inicioDiaLima, finDiaLima } from "@/lib/fecha";

export type FilaCuadroControl = {
  almacenId: string;
  almacenNombre: string;
  productoId: string;
  productoNombre: string;
  unidadMedida: string;
  saldoAnterior: number;
  trasladada: number;
  vendida: number;
  abastecida: number;
  merma: number;
  diferencia: number;
};

export type CuadroControlFiltro = {
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  almacenId?: string | null;
};

// Cuadro de Control de Productos: por producto y almacén, el saldo que ya
// tenía antes del rango filtrado, cuánto entró por traslado, cuánto se
// vendió, cuánto se abasteció en campo y cuánta merma tuvo — con el stock
// actual esperado (diferencia = saldo anterior + trasladada + abastecida
// − vendida − merma).
export async function fetchCuadroControlProductos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { fechaDesde, fechaHasta, almacenId }: CuadroControlFiltro,
): Promise<{ filas: FilaCuadroControl[]; error: string | null }> {
  let movimientosQuery = supabase
    .from("kardex_movimientos")
    .select(
      "almacen_id, producto_id, tipo_movimiento, cantidad, referencia_id, almacenes(nombre), productos(nombre, unidades_medida!productos_unidad_medida_id_fkey(descripcion))",
    )
    .in("tipo_movimiento", ["traslado_entrada", "venta", "abastecimiento_campo", "merma", "ajuste"]);

  if (fechaDesde) movimientosQuery = movimientosQuery.gte("fecha", inicioDiaLima(fechaDesde));
  if (fechaHasta) movimientosQuery = movimientosQuery.lte("fecha", finDiaLima(fechaHasta));
  if (almacenId) movimientosQuery = movimientosQuery.eq("almacen_id", almacenId);

  const { data: movimientos, error } = await movimientosQuery;
  if (error) return { filas: [], error: error.message };

  // Los "ajuste" son la corrección que se emite al editar una venta o un
  // abastecimiento en campo ya registrados (el kardex nunca reescribe lo
  // ya guardado, así que la corrección queda como un movimiento aparte,
  // fechado el día en que se hizo la corrección, no el día original). Para
  // que Vendida/Abastecida reflejen las cantidades ya corregidas, cada
  // ajuste se atribuye de vuelta a esa columna según a qué detalle
  // apunta su referencia_id — sin eso, una corrección quedaba invisible
  // en este cuadro.
  const ajustes = (movimientos ?? []).filter(
    (m) => m.tipo_movimiento === "ajuste" && m.referencia_id,
  );
  const referenciaIds = [...new Set(ajustes.map((m) => m.referencia_id as string))];
  let ventaDetalleIds = new Set<string>();
  let abastecimientoDetalleIds = new Set<string>();
  if (referenciaIds.length > 0) {
    const [{ data: ventaDetalles }, { data: abastDetalles }] = await Promise.all([
      supabase.from("venta_detalle").select("id").in("id", referenciaIds),
      supabase.from("abastecimiento_campo_detalle").select("id").in("id", referenciaIds),
    ]);
    ventaDetalleIds = new Set((ventaDetalles ?? []).map((d) => d.id));
    abastecimientoDetalleIds = new Set((abastDetalles ?? []).map((d) => d.id));
  }

  const mapa = new Map<string, FilaCuadroControl>();
  for (const m of movimientos ?? []) {
    const key = `${m.almacen_id}::${m.producto_id}`;
    const almacen = m.almacenes as unknown as { nombre: string } | null;
    const producto = m.productos as unknown as {
      nombre: string;
      unidades_medida: { descripcion: string } | null;
    } | null;

    if (!mapa.has(key)) {
      mapa.set(key, {
        almacenId: m.almacen_id,
        almacenNombre: almacen?.nombre ?? "—",
        productoId: m.producto_id,
        productoNombre: producto?.nombre ?? "—",
        unidadMedida: producto?.unidades_medida?.descripcion ?? "—",
        saldoAnterior: 0,
        trasladada: 0,
        vendida: 0,
        abastecida: 0,
        merma: 0,
        diferencia: 0,
      });
    }
    const fila = mapa.get(key)!;
    const cantidad = Math.abs(m.cantidad);
    if (m.tipo_movimiento === "traslado_entrada") fila.trasladada += cantidad;
    else if (m.tipo_movimiento === "venta") fila.vendida += cantidad;
    else if (m.tipo_movimiento === "abastecimiento_campo") fila.abastecida += cantidad;
    else if (m.tipo_movimiento === "merma") fila.merma += cantidad;
    else if (m.tipo_movimiento === "ajuste" && m.referencia_id) {
      // Sin Math.abs: el ajuste ya viene con el signo correcto del delta
      // (positivo si la corrección sumó stock, negativo si lo quitó).
      if (ventaDetalleIds.has(m.referencia_id)) fila.vendida -= m.cantidad;
      else if (abastecimientoDetalleIds.has(m.referencia_id)) fila.abastecida += m.cantidad;
    }
  }

  const filas = [...mapa.values()];

  // Saldo anterior: el saldo_resultante del último movimiento de cada
  // producto+almacén antes del inicio del rango filtrado (el kardex es un
  // ledger inmutable con saldo corrido, así que ese último valor antes del
  // corte ES el stock que había al empezar el rango). Sin un "desde"
  // explícito no hay un corte real que calcular — queda en 0.
  if (filas.length > 0 && fechaDesde) {
    const corte = inicioDiaLima(fechaDesde);
    let saldoQuery = supabase
      .from("kardex_movimientos")
      .select("almacen_id, producto_id, fecha, saldo_resultante")
      .in("almacen_id", [...new Set(filas.map((f) => f.almacenId))])
      .in("producto_id", [...new Set(filas.map((f) => f.productoId))])
      .lt("fecha", corte)
      .order("fecha", { ascending: true });
    if (almacenId) saldoQuery = saldoQuery.eq("almacen_id", almacenId);

    const { data: previos } = await saldoQuery;
    const saldoPorClave = new Map<string, number>();
    for (const p of previos ?? []) {
      // En orden ascendente, el último write por clave queda como el saldo
      // vigente justo antes del corte.
      saldoPorClave.set(`${p.almacen_id}::${p.producto_id}`, p.saldo_resultante);
    }
    for (const fila of filas) {
      fila.saldoAnterior = saldoPorClave.get(`${fila.almacenId}::${fila.productoId}`) ?? 0;
    }
  }

  for (const fila of filas) {
    fila.diferencia =
      fila.saldoAnterior + fila.trasladada + fila.abastecida - fila.vendida - fila.merma;
  }

  return { filas, error: null };
}

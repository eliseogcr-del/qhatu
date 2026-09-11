import { createClient } from "./server";
import { inicioDiaLima, finDiaLima } from "@/lib/fecha";

export type FilaCuadroControl = {
  almacenId: string;
  almacenNombre: string;
  productoId: string;
  productoNombre: string;
  unidadMedida: string;
  trasladada: number;
  vendida: number;
  abastecida: number;
  merma: number;
  inventario: number;
  diferencia: number;
};

export type CuadroControlFiltro = {
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  almacenId?: string | null;
};

// Cuadro de Control de Productos: por producto y almacén, cuánto entró por
// traslado, cuánto se vendió, cuánto se abasteció en campo, cuánta merma
// tuvo y el inventario actual — con la diferencia esperada
// (trasladada + abastecida − vendida − merma) contra ese inventario.
export async function fetchCuadroControlProductos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { fechaDesde, fechaHasta, almacenId }: CuadroControlFiltro,
): Promise<{ filas: FilaCuadroControl[]; error: string | null }> {
  let movimientosQuery = supabase
    .from("kardex_movimientos")
    .select(
      "almacen_id, producto_id, tipo_movimiento, cantidad, almacenes(nombre), productos(nombre, unidades_medida!productos_unidad_medida_id_fkey(descripcion))",
    )
    .in("tipo_movimiento", ["traslado_entrada", "venta", "abastecimiento_campo", "merma"]);

  if (fechaDesde) movimientosQuery = movimientosQuery.gte("fecha", inicioDiaLima(fechaDesde));
  if (fechaHasta) movimientosQuery = movimientosQuery.lte("fecha", finDiaLima(fechaHasta));
  if (almacenId) movimientosQuery = movimientosQuery.eq("almacen_id", almacenId);

  const { data: movimientos, error } = await movimientosQuery;
  if (error) return { filas: [], error: error.message };

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
        trasladada: 0,
        vendida: 0,
        abastecida: 0,
        merma: 0,
        inventario: 0,
        diferencia: 0,
      });
    }
    const fila = mapa.get(key)!;
    const cantidad = Math.abs(m.cantidad);
    if (m.tipo_movimiento === "traslado_entrada") fila.trasladada += cantidad;
    else if (m.tipo_movimiento === "venta") fila.vendida += cantidad;
    else if (m.tipo_movimiento === "abastecimiento_campo") fila.abastecida += cantidad;
    else if (m.tipo_movimiento === "merma") fila.merma += cantidad;
  }

  const filas = [...mapa.values()];

  if (filas.length > 0) {
    const { data: inventarios } = await supabase
      .from("inventario")
      .select("almacen_id, producto_id, stock_actual")
      .in("almacen_id", [...new Set(filas.map((f) => f.almacenId))])
      .in("producto_id", [...new Set(filas.map((f) => f.productoId))]);

    const stockPorClave = new Map(
      (inventarios ?? []).map((i) => [`${i.almacen_id}::${i.producto_id}`, i.stock_actual]),
    );
    for (const fila of filas) {
      fila.inventario = stockPorClave.get(`${fila.almacenId}::${fila.productoId}`) ?? 0;
    }
  }

  for (const fila of filas) {
    fila.diferencia = fila.trasladada + fila.abastecida - fila.vendida - fila.merma;
  }

  return { filas, error: null };
}

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
  trasladoSalida: number;
  merma: number;
};

export type CuadroControlFiltro = {
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  almacenId?: string | null;
};

// Cuadro de Control de Productos: por producto y almacén, cuánto entró por
// traslado, cuánto se vendió, cuánto se abasteció en campo, cuánto salió
// por traslado hacia otro almacén y cuánta merma tuvo.
export async function fetchCuadroControlProductos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { fechaDesde, fechaHasta, almacenId }: CuadroControlFiltro,
): Promise<{ filas: FilaCuadroControl[]; error: string | null }> {
  let movimientosQuery = supabase
    .from("kardex_movimientos")
    .select(
      "almacen_id, producto_id, tipo_movimiento, cantidad, referencia_id, almacenes(nombre), productos(nombre, unidades_medida!productos_unidad_medida_id_fkey(descripcion))",
    )
    .in("tipo_movimiento", [
      "traslado_entrada",
      "venta",
      "abastecimiento_campo",
      "traslado_salida",
      "merma",
      "ajuste",
    ]);

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
        trasladada: 0,
        vendida: 0,
        abastecida: 0,
        trasladoSalida: 0,
        merma: 0,
      });
    }
    const fila = mapa.get(key)!;
    const cantidad = Math.abs(m.cantidad);
    if (m.tipo_movimiento === "traslado_entrada") fila.trasladada += cantidad;
    else if (m.tipo_movimiento === "venta") fila.vendida += cantidad;
    else if (m.tipo_movimiento === "abastecimiento_campo") fila.abastecida += cantidad;
    else if (m.tipo_movimiento === "traslado_salida") fila.trasladoSalida += cantidad;
    else if (m.tipo_movimiento === "merma") fila.merma += cantidad;
    else if (m.tipo_movimiento === "ajuste" && m.referencia_id) {
      // Sin Math.abs: el ajuste ya viene con el signo correcto del delta
      // (positivo si la corrección sumó stock, negativo si lo quitó).
      if (ventaDetalleIds.has(m.referencia_id)) fila.vendida -= m.cantidad;
      else if (abastecimientoDetalleIds.has(m.referencia_id)) fila.abastecida += m.cantidad;
    }
  }

  const filas = [...mapa.values()];

  return { filas, error: null };
}

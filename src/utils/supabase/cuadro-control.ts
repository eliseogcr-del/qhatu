import { createClient } from "./server";
import { inicioDiaLima, finDiaLima } from "@/lib/fecha";

// Cada tipo de movimiento del kardex cae siempre del mismo lado (entrada o
// salida) salvo "ajuste", que es una corrección con signo libre (puede
// sumar o restar stock) — por eso se parte en dos columnas propias según
// el signo de cada movimiento, en vez de intentar adivinar a qué categoría
// original pertenece.
export const COLUMNA_LABEL: Record<string, string> = {
  compra: "Compra",
  traslado_entrada: "Traslado (entrada)",
  abastecimiento_campo: "Abastecimiento en campo",
  produccion: "Producción",
  ajuste_entrada: "Ajuste (entrada)",
  venta: "Venta",
  traslado_salida: "Traslado (salida)",
  merma: "Merma",
  ajuste_salida: "Ajuste (salida)",
};

export const COLUMNA_GRUPO: Record<string, "entrada" | "salida"> = {
  compra: "entrada",
  traslado_entrada: "entrada",
  abastecimiento_campo: "entrada",
  produccion: "entrada",
  ajuste_entrada: "entrada",
  venta: "salida",
  traslado_salida: "salida",
  merma: "salida",
  ajuste_salida: "salida",
};

// Orden fijo en el que aparecen las columnas dentro de cada grupo (cuando
// están presentes en los datos).
const ORDEN_COLUMNAS = [
  "compra",
  "traslado_entrada",
  "abastecimiento_campo",
  "produccion",
  "ajuste_entrada",
  "venta",
  "traslado_salida",
  "merma",
  "ajuste_salida",
];

export type FilaCuadroControl = {
  almacenId: string;
  almacenNombre: string;
  productoId: string;
  productoNombre: string;
  unidadMedida: string;
  // Suma de cantidad (con signo, tal cual está en el kardex) por columna
  // dinámica — ej. cantidadesPorColumna["venta"], cantidadesPorColumna["ajuste_entrada"].
  cantidadesPorColumna: Record<string, number>;
  // Stock real de hoy (tabla inventario), no la suma del rango filtrado —
  // así siempre coincide con lo que muestra Inventario, sin importar qué
  // fechas se hayan elegido acá.
  stockActual: number;
};

export type CuadroControlFiltro = {
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  almacenId?: string | null;
};

// Cuadro de Control de Productos: una fila por producto y almacén con,
// como columnas, cada tipo de movimiento de kardex que tuvo en el rango
// filtrado (entradas y salidas), y al final el stock actual real. Es la
// misma información que el Kardex, pero pivotada por tipo de movimiento en
// vez de mostrar un renglón por cada movimiento.
export async function fetchCuadroControlProductos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { fechaDesde, fechaHasta, almacenId }: CuadroControlFiltro,
): Promise<{ filas: FilaCuadroControl[]; columnas: string[]; error: string | null }> {
  let movimientosQuery = supabase
    .from("kardex_movimientos")
    .select(
      "almacen_id, producto_id, tipo_movimiento, cantidad, almacenes(nombre), productos(nombre, unidades_medida!productos_unidad_medida_id_fkey(descripcion))",
    );

  if (fechaDesde) movimientosQuery = movimientosQuery.gte("fecha", inicioDiaLima(fechaDesde));
  if (fechaHasta) movimientosQuery = movimientosQuery.lte("fecha", finDiaLima(fechaHasta));
  if (almacenId) movimientosQuery = movimientosQuery.eq("almacen_id", almacenId);

  const { data: movimientos, error } = await movimientosQuery;
  if (error) return { filas: [], columnas: [], error: error.message };

  const mapa = new Map<string, FilaCuadroControl>();
  const columnasPresentes = new Set<string>();

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
        cantidadesPorColumna: {},
        stockActual: 0,
      });
    }
    const fila = mapa.get(key)!;

    const columna =
      m.tipo_movimiento === "ajuste"
        ? m.cantidad >= 0
          ? "ajuste_entrada"
          : "ajuste_salida"
        : m.tipo_movimiento;

    fila.cantidadesPorColumna[columna] = (fila.cantidadesPorColumna[columna] ?? 0) + m.cantidad;
    columnasPresentes.add(columna);
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
      fila.stockActual = stockPorClave.get(`${fila.almacenId}::${fila.productoId}`) ?? 0;
    }
  }

  const columnas = ORDEN_COLUMNAS.filter((c) => columnasPresentes.has(c));

  return { filas, columnas, error: null };
}

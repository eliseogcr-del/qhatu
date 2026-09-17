import { createClient } from "./server";
import type { NubefactItem } from "../nubefact";
import { TIPO_NOTA_VENTA } from "@/lib/comprobante-links";

// Porcentaje real de esta empresa (10.5%, no el 18% de régimen general) —
// configurable en Administración → Facturación electrónica, junto a las
// series. Si por lo que sea la fila de configuración no existe todavía,
// se usa ese mismo 10.5% como respaldo en vez del 18% genérico.
async function obtenerPorcentajeIgv(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
): Promise<number> {
  const { data } = await supabase
    .from("configuracion_facturacion")
    .select("porcentaje_igv")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data?.porcentaje_igv ?? 10.5;
}

// Compartido entre la emisión de comprobantes Nubefact (factura/boleta/NC)
// y la nota de venta interna — ambos parten de las mismas líneas
// entregadas de la venta.
export async function construirItemsYTotales(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ventaId: string,
  empresaId: string,
) {
  const [{ data: detalle }, porcentajeIgv] = await Promise.all([
    supabase
      .from("venta_detalle")
      .select("cantidad_entregada, precio_unitario, subtotal, productos(nombre)")
      .eq("venta_id", ventaId)
      .gt("cantidad_entregada", 0),
    obtenerPorcentajeIgv(supabase, empresaId),
  ]);

  if (!detalle || detalle.length === 0) return null;

  const factorIgv = porcentajeIgv / 100;
  const items: NubefactItem[] = detalle.map((d) => {
    const valorUnitario = Math.round((d.precio_unitario / (1 + factorIgv)) * 100) / 100;
    const subtotalSinIgv = Math.round(valorUnitario * d.cantidad_entregada * 100) / 100;
    const igvLinea = Math.round((d.subtotal - subtotalSinIgv) * 100) / 100;
    return {
      unidad_de_medida: "NIU",
      descripcion: (d.productos as unknown as { nombre: string } | null)?.nombre ?? "Producto",
      cantidad: d.cantidad_entregada,
      valor_unitario: valorUnitario,
      precio_unitario: d.precio_unitario,
      subtotal: subtotalSinIgv,
      tipo_de_igv: 1,
      igv: igvLinea,
      total: d.subtotal,
      anticipo_regularizacion: false,
    };
  });

  const totalGravada = Math.round(items.reduce((acc, i) => acc + i.subtotal, 0) * 100) / 100;
  const totalIgv = Math.round(items.reduce((acc, i) => acc + i.igv, 0) * 100) / 100;
  const total = Math.round((totalGravada + totalIgv) * 100) / 100;

  return { items, totalGravada, totalIgv, total, porcentajeIgv };
}

// La nota de venta ya no depende de que alguien la pida a mano — toda
// venta debería tener la suya desde el momento en que se registra,
// numerada correlativamente por almacén (series_nota_venta), igual que
// antes hacía el botón "Emitir nota de venta". No llama a Nubefact (es
// un documento interno) y nunca bloquea la creación de la venta: si algo
// sale mal acá, la venta ya quedó guardada de todas formas.
export async function crearNotaVentaAutomatica(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: { empresaId: string; userId: string; ventaId: string; almacenId: string },
): Promise<{ error: string | null }> {
  const { empresaId, userId, ventaId, almacenId } = params;

  const { data: serieConfig } = await supabase
    .from("series_nota_venta")
    .select("serie")
    .eq("almacen_id", almacenId)
    .maybeSingle();

  const serie = serieConfig?.serie ?? "NV01";

  const { data: ultimo } = await supabase
    .from("comprobantes")
    .select("numero")
    .eq("empresa_id", empresaId)
    .eq("tipo_comprobante", TIPO_NOTA_VENTA)
    .eq("almacen_id", almacenId)
    .eq("serie", serie)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  const numero = (ultimo?.numero ?? 0) + 1;

  const { error } = await supabase.from("comprobantes").insert({
    empresa_id: empresaId,
    venta_id: ventaId,
    almacen_id: almacenId,
    tipo_comprobante: TIPO_NOTA_VENTA,
    serie,
    numero,
    estado: "emitido",
    usuario_id: userId,
  });

  return { error: error?.message ?? null };
}

export function fechaDeHoy() {
  const hoy = new Date();
  return `${String(hoy.getDate()).padStart(2, "0")}-${String(hoy.getMonth() + 1).padStart(
    2,
    "0",
  )}-${hoy.getFullYear()}`;
}

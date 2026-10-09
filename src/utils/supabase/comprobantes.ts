import { redirect } from "next/navigation";
import { createClient } from "./server";
import { llamarNubefact, type NubefactItem, type NubefactRequest, type NubefactResponse } from "../nubefact";
import { TIPO_NOTA_VENTA } from "@/lib/comprobante-links";

// Porcentaje real de esta empresa (10.5%, no el 18% de régimen general) —
// configurable en Administración → Facturación electrónica, junto a las
// series. Si por lo que sea la fila de configuración no existe todavía,
// se usa ese mismo 10.5% como respaldo en vez del 18% genérico.
export async function obtenerPorcentajeIgv(
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

// Misma matemática de construirItemsYTotales (precio_unitario siempre
// con IGV incluido, el IGV se extrae del total en vez de sumarse encima)
// pero recibiendo las líneas ya resueltas en vez de salir a buscarlas —
// así sirve tanto para las líneas reales de un comprobante libre como
// para una línea sintética (ej. el descuento del anticipo, con montos en
// negativo: la misma fórmula funciona igual sin ningún caso especial).
export function itemsDesdeLineas(
  lineas: { descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }[],
  porcentajeIgv: number,
): { items: NubefactItem[]; totalGravada: number; totalIgv: number; total: number } {
  const factorIgv = porcentajeIgv / 100;
  const items: NubefactItem[] = lineas.map((d) => {
    const valorUnitario = Math.round((d.precio_unitario / (1 + factorIgv)) * 100) / 100;
    const subtotalSinIgv = Math.round(valorUnitario * d.cantidad * 100) / 100;
    const igvLinea = Math.round((d.subtotal - subtotalSinIgv) * 100) / 100;
    return {
      unidad_de_medida: "NIU",
      descripcion: d.descripcion,
      cantidad: d.cantidad,
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
  return { items, totalGravada, totalIgv, total };
}

// Trae las líneas ya guardadas de un comprobante libre (usado para "traer
// el monto" del Anticipo al armar la línea de descuento de su Saldo).
export async function construirItemsYTotalesLibre(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comprobanteId: string,
  empresaId: string,
) {
  const [{ data: detalle }, porcentajeIgv] = await Promise.all([
    supabase
      .from("comprobante_libre_detalle")
      .select("descripcion, cantidad, precio_unitario, subtotal")
      .eq("comprobante_id", comprobanteId),
    obtenerPorcentajeIgv(supabase, empresaId),
  ]);
  if (!detalle || detalle.length === 0) return null;
  return { ...itemsDesdeLineas(detalle, porcentajeIgv), porcentajeIgv };
}

// Reserva la fila en comprobantes, llama a Nubefact, y actualiza el
// resultado (o el error) — compartido entre emitir un comprobante de
// venta, la nota de crédito que anula uno, y los comprobantes libres
// (anticipo/saldo). Si algo falla, redirige con el mensaje
// correspondiente y nunca vuelve al llamador.
export async function guardarYEmitir(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    insert: {
      empresa_id: string;
      usuario_id: string;
      tipo_comprobante: number;
      serie: string;
      numero: number;
      venta_id?: string | null;
      almacen_id?: string | null;
      cliente_id?: string | null;
      origen?: string;
      tipo_emision?: string | null;
      comprobante_anticipo_id?: string | null;
      descripcion?: string | null;
    };
    payload: NubefactRequest;
    etiqueta: string;
    redirectBase: string;
  },
): Promise<string> {
  const { insert, payload, etiqueta, redirectBase } = params;

  const { data: comprobante, error: insertError } = await supabase
    .from("comprobantes")
    .insert({ ...insert, estado: "pendiente" })
    .select("id")
    .single();

  if (insertError || !comprobante) {
    redirect(
      `${redirectBase}?error=${encodeURIComponent(insertError?.message ?? `No se pudo reservar ${etiqueta}.`)}`,
    );
  }

  // El redirect() de Next lanza internamente su propia excepción para
  // funcionar — nunca debe llamarse dentro de un try/catch de errores
  // reales, o quedaría atrapado ahí y no navegaría a ningún lado.
  let respuesta: NubefactResponse | null = null;
  let errorConexion: string | null = null;
  try {
    respuesta = await llamarNubefact(payload);
  } catch (err) {
    errorConexion =
      err instanceof Error ? err.message : "Error desconocido al conectar con Nubefact.";
  }

  if (errorConexion) {
    await supabase
      .from("comprobantes")
      .update({ estado: "error", error_mensaje: errorConexion })
      .eq("id", comprobante.id);
    redirect(
      `${redirectBase}?error=${encodeURIComponent(`No se pudo conectar con Nubefact: ${errorConexion}`)}`,
    );
  }

  if (respuesta!.errors) {
    await supabase
      .from("comprobantes")
      .update({ estado: "error", error_mensaje: respuesta!.errors })
      .eq("id", comprobante.id);
    redirect(
      `${redirectBase}?error=${encodeURIComponent(`Nubefact rechazó ${etiqueta}: ${respuesta!.errors}`)}`,
    );
  }

  await supabase
    .from("comprobantes")
    .update({
      estado: "emitido",
      aceptado_por_sunat: respuesta!.aceptada_por_sunat ?? null,
      sunat_description: respuesta!.sunat_description ?? null,
      enlace: respuesta!.enlace ?? null,
      enlace_pdf: respuesta!.enlace_del_pdf ?? null,
      enlace_xml: respuesta!.enlace_del_xml ?? null,
      enlace_cdr: respuesta!.enlace_del_cdr ?? null,
    })
    .eq("id", comprobante.id);

  return comprobante.id;
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

// Igual que fechaDeHoy pero para una fecha elegida a mano (comprobantes
// libres) — "AAAA-MM-DD" de un <input type="date"> a "DD-MM-AAAA", sin
// pasar por Date() para no arriesgar un corrimiento de zona horaria.
export function fechaNubefact(fecha: string) {
  const [anio, mes, dia] = fecha.split("-");
  return `${dia}-${mes}-${anio}`;
}

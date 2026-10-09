"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import {
  obtenerPorcentajeIgv,
  itemsDesdeLineas,
  construirItemsYTotalesLibre,
  guardarYEmitir,
  fechaNubefact,
} from "@/utils/supabase/comprobantes";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import { tipoDocumentoNubefact, type NubefactRequest } from "@/utils/nubefact";

export async function emitirComprobanteLibre(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await requireComprobantesAcceso(supabase);

  const clienteId = String(formData.get("cliente_id") || "");
  const fechaEmision = String(formData.get("fecha_emision") || "");
  const tipoComprobante = Number(formData.get("tipo_comprobante") || 2);
  const tipoEmisionRaw = String(formData.get("tipo_emision") || "");
  const tipoEmision = tipoEmisionRaw === "anticipo" || tipoEmisionRaw === "saldo" ? tipoEmisionRaw : null;
  const comprobanteAnticipoId = String(formData.get("comprobante_anticipo_id") || "") || null;
  const descripcion = String(formData.get("descripcion") || "").trim() || null;

  const productoIds = formData.getAll("producto_id[]").map((v) => String(v) || null);
  const descripciones = formData.getAll("descripcion_linea[]").map((v) => String(v));
  const cantidades = formData.getAll("cantidad[]").map((v) => Number(v));
  const precios = formData.getAll("precio_unitario[]").map((v) => Number(v));

  if (!clienteId) {
    redirect(`/comprobantes-libres/nuevo?error=${encodeURIComponent("Selecciona un cliente.")}`);
  }
  if (!fechaEmision) {
    redirect(`/comprobantes-libres/nuevo?error=${encodeURIComponent("Selecciona la fecha de emisión.")}`);
  }
  if (tipoEmision === "saldo" && !comprobanteAnticipoId) {
    redirect(
      `/comprobantes-libres/nuevo?error=${encodeURIComponent("Selecciona el comprobante de anticipo que estás regularizando.")}`,
    );
  }

  const lineas = descripciones
    .map((desc, i) => ({
      productoId: productoIds[i] || null,
      descripcion: desc.trim(),
      cantidad: cantidades[i] || 0,
      precio_unitario: precios[i] || 0,
    }))
    .filter((l) => l.descripcion && l.cantidad > 0 && l.precio_unitario > 0);

  if (lineas.length === 0) {
    redirect(
      `/comprobantes-libres/nuevo?error=${encodeURIComponent("Agrega al menos una línea con descripción, cantidad y precio.")}`,
    );
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("tipo_documento, numero_documento, nombre, direccion")
    .eq("id", clienteId)
    .single();

  if (!cliente) {
    redirect(`/comprobantes-libres/nuevo?error=${encodeURIComponent("Cliente inválido.")}`);
  }

  if (tipoComprobante === 1 && cliente.tipo_documento !== "RUC") {
    redirect(
      `/comprobantes-libres/nuevo?error=${encodeURIComponent("Solo se puede emitir Factura a un cliente con RUC.")}`,
    );
  }

  const documento = cliente.numero_documento.trim();
  const longitudEsperada: Record<string, number> = { DNI: 8, RUC: 11 };
  const esperada = longitudEsperada[cliente.tipo_documento];
  if (esperada && documento.length !== esperada) {
    redirect(
      `/comprobantes-libres/nuevo?error=${encodeURIComponent(
        `El ${cliente.tipo_documento} del cliente debe tener ${esperada} dígitos (tiene ${documento.length}: "${documento}"). Corrígelo en Clientes antes de emitir el comprobante.`,
      )}`,
    );
  }

  const { data: config } = await supabase
    .from("configuracion_facturacion")
    .select("serie_factura, serie_boleta")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!config) {
    redirect(
      `/comprobantes-libres/nuevo?error=${encodeURIComponent(
        "Falta configurar las series de facturación. Ve a Administración → Facturación electrónica.",
      )}`,
    );
  }

  const serie = tipoComprobante === 1 ? config.serie_factura : config.serie_boleta;
  // Misma serie que las facturas/boletas de venta — el correlativo que
  // SUNAT ve es uno solo por tipo+serie, sin importar si el documento
  // nace de una venta o de un comprobante libre.
  const { data: ultimo } = await supabase
    .from("comprobantes")
    .select("numero")
    .eq("empresa_id", empresaId)
    .eq("tipo_comprobante", tipoComprobante)
    .eq("serie", serie)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  const numero = (ultimo?.numero ?? 0) + 1;

  const porcentajeIgv = await obtenerPorcentajeIgv(supabase, empresaId);

  const lineasParaItems = lineas.map((l) => ({
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    subtotal: Math.round(l.cantidad * l.precio_unitario * 100) / 100,
  }));

  // Factura de Saldo: se trae el monto ya facturado en el Anticipo
  // seleccionado y se arma la línea de descuento que lo resta — el
  // usuario nunca escribe ese monto a mano, para que no se pueda
  // descuadrar del anticipo real.
  let anticipo: { id: string; tipo_comprobante: number; serie: string; numero: number } | null = null;
  if (tipoEmision === "saldo" && comprobanteAnticipoId) {
    const { data: anticipoRow } = await supabase
      .from("comprobantes")
      .select("id, tipo_comprobante, serie, numero")
      .eq("id", comprobanteAnticipoId)
      .eq("origen", "libre")
      .eq("tipo_emision", "anticipo")
      .single();

    if (!anticipoRow) {
      redirect(
        `/comprobantes-libres/nuevo?error=${encodeURIComponent("El comprobante de anticipo seleccionado ya no existe.")}`,
      );
    }
    anticipo = anticipoRow;

    const totalesAnticipo = await construirItemsYTotalesLibre(supabase, anticipoRow.id, empresaId);
    if (!totalesAnticipo) {
      redirect(
        `/comprobantes-libres/nuevo?error=${encodeURIComponent("No se pudo leer el monto del anticipo seleccionado.")}`,
      );
    }

    lineasParaItems.push({
      descripcion: `Anticipo (-) ${TIPO_COMPROBANTE_LABEL[anticipoRow.tipo_comprobante]} ${anticipoRow.serie}-${anticipoRow.numero}`,
      cantidad: 1,
      precio_unitario: -totalesAnticipo.total,
      subtotal: -totalesAnticipo.total,
    });
  }

  const totales = itemsDesdeLineas(lineasParaItems, porcentajeIgv);
  // La última línea es la del descuento del anticipo (si la hay) — se
  // marca para que Nubefact/SUNAT sepan que es la regularización, no un
  // producto más.
  if (anticipo) {
    totales.items[totales.items.length - 1].anticipo_regularizacion = true;
  }

  const payload: NubefactRequest = {
    operacion: "generar_comprobante",
    tipo_de_comprobante: tipoComprobante,
    serie,
    numero,
    sunat_transaction: 1,
    cliente_tipo_de_documento: tipoDocumentoNubefact(cliente.tipo_documento),
    cliente_numero_de_documento: cliente.numero_documento,
    cliente_denominacion: cliente.nombre,
    cliente_direccion: cliente.direccion ?? undefined,
    fecha_de_emision: fechaNubefact(fechaEmision),
    moneda: 1,
    porcentaje_de_igv: porcentajeIgv,
    total_gravada: totales.totalGravada,
    total_igv: totales.totalIgv,
    total: totales.total,
    items: totales.items,
  };

  const comprobanteId = await guardarYEmitir(supabase, {
    insert: {
      empresa_id: empresaId,
      usuario_id: userId,
      cliente_id: clienteId,
      origen: "libre",
      tipo_emision: tipoEmision,
      comprobante_anticipo_id: anticipo?.id ?? null,
      descripcion,
      tipo_comprobante: tipoComprobante,
      serie,
      numero,
    },
    payload,
    etiqueta: "el comprobante",
    redirectBase: "/comprobantes-libres/nuevo",
  });

  // Las líneas quedan guardadas tal cual se enviaron a Nubefact (incluida
  // la de descuento del anticipo) — así el detalle en pantalla nunca se
  // desincroniza de lo que realmente se declaró.
  await supabase.from("comprobante_libre_detalle").insert(
    lineas.map((l, i) => ({
      comprobante_id: comprobanteId,
      producto_id: l.productoId,
      descripcion: l.descripcion,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      subtotal: lineasParaItems[i].subtotal,
    })),
  );
  if (anticipo) {
    const lineaDescuento = lineasParaItems[lineasParaItems.length - 1];
    await supabase.from("comprobante_libre_detalle").insert({
      comprobante_id: comprobanteId,
      producto_id: null,
      descripcion: lineaDescuento.descripcion,
      cantidad: lineaDescuento.cantidad,
      precio_unitario: lineaDescuento.precio_unitario,
      subtotal: lineaDescuento.subtotal,
    });
  }

  revalidatePath("/comprobantes-libres");
  redirect("/comprobantes-libres?emitido=1");
}

// Asociar es solo una referencia de trazabilidad (qué tipo y número de
// documento corresponde a esta venta) — a propósito no valida que el
// monto del comprobante cuadre con el de la venta, tal como se pidió.
export async function asociarComprobanteLibre(ventaId: string, formData: FormData) {
  const supabase = await createClient();
  await requireComprobantesAcceso(supabase);

  const comprobanteId = String(formData.get("comprobante_id") || "");
  if (!comprobanteId) {
    redirect(`/ventas/${ventaId}?error=${encodeURIComponent("Selecciona un comprobante para asociar.")}`);
  }

  // .is("venta_id", null) evita pisar una asociación que ya tenga (ej. si
  // alguien lo asoció a otra venta justo antes, en otra pestaña).
  const { error } = await supabase
    .from("comprobantes")
    .update({ venta_id: ventaId })
    .eq("id", comprobanteId)
    .eq("origen", "libre")
    .is("venta_id", null);

  if (error) {
    redirect(`/ventas/${ventaId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/comprobantes-libres");
  redirect(`/ventas/${ventaId}`);
}

export async function desasociarComprobanteLibre(comprobanteId: string, ventaId: string) {
  const supabase = await createClient();
  await requireComprobantesAcceso(supabase);

  const { error } = await supabase
    .from("comprobantes")
    .update({ venta_id: null })
    .eq("id", comprobanteId)
    .eq("origen", "libre");

  if (error) {
    redirect(`/ventas/${ventaId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/comprobantes-libres");
  redirect(`/ventas/${ventaId}`);
}

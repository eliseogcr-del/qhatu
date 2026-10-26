"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import {
  obtenerPorcentajeIgv,
  itemsDesdeLineas,
  construirItemsYTotalesLibre,
  reintentarEmision,
  fechaNubefact,
  siguienteNumeroComprobante,
} from "@/utils/supabase/comprobantes";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import { tipoDocumentoNubefact, type NubefactRequest } from "@/utils/nubefact";

export type PedidoPendienteLibre = {
  id: string;
  fecha: string;
  items: { productoId: string; descripcion: string; cantidad: number; precioUnitario: number }[];
};

// Para el botón "Cargar pedido del cliente" del formulario de emisión —
// solo copia las líneas a la pantalla, no guarda ninguna referencia al
// pedido ni lo toca de ninguna forma (no afecta logística/kardex, el
// pedido sigue exactamente igual de pendiente que antes).
export async function obtenerPedidosPendientesCliente(
  clienteId: string,
): Promise<PedidoPendienteLibre[]> {
  if (!clienteId) return [];
  const supabase = await createClient();
  await requireComprobantesAcceso(supabase);

  const { data: pedidos } = await supabase
    .from("pedidos")
    .select(
      "id, fecha, ventas(id), pedido_detalle(producto_id, cantidad, precio_unitario, productos(nombre))",
    )
    .eq("cliente_id", clienteId)
    .neq("estado", "cancelado")
    .order("fecha", { ascending: false });

  return (pedidos ?? [])
    .filter((p) => !(p.ventas as unknown as { id: string }[] | null)?.length)
    .map((p) => ({
      id: p.id,
      fecha: p.fecha,
      items: (
        p.pedido_detalle as unknown as {
          producto_id: string;
          cantidad: number;
          precio_unitario: number;
          productos: { nombre: string } | null;
        }[]
      ).map((d) => ({
        productoId: d.producto_id,
        descripcion: d.productos?.nombre ?? "Producto",
        cantidad: d.cantidad,
        precioUnitario: d.precio_unitario,
      })),
    }));
}

// Valida los datos del formulario y arma el payload para Nubefact —
// compartido entre crear un comprobante libre nuevo (emitirComprobanteLibre,
// que además resuelve serie+número) y editar/reintentar uno que quedó en
// pendiente/error (editarComprobanteLibre, que reutiliza el tipo+serie+
// número ya reservados en vez de pedir uno nuevo).
async function validarYArmarPayload(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
  formData: FormData,
  params: { tipoComprobante: number; serie: string; numero: number; redirectBase: string },
) {
  const { tipoComprobante, serie, numero, redirectBase } = params;

  const clienteId = String(formData.get("cliente_id") || "");
  const fechaEmision = String(formData.get("fecha_emision") || "");
  const tipoEmisionRaw = String(formData.get("tipo_emision") || "");
  const tipoEmision = tipoEmisionRaw === "anticipo" || tipoEmisionRaw === "saldo" ? tipoEmisionRaw : null;
  const comprobanteAnticipoId = String(formData.get("comprobante_anticipo_id") || "") || null;
  const descripcion = String(formData.get("descripcion") || "").trim() || null;

  const productoIds = formData.getAll("producto_id[]").map((v) => String(v) || null);
  const descripciones = formData.getAll("descripcion_linea[]").map((v) => String(v));
  const cantidades = formData.getAll("cantidad[]").map((v) => Number(v));
  const precios = formData.getAll("precio_unitario[]").map((v) => Number(v));

  if (!clienteId) {
    redirect(`${redirectBase}?error=${encodeURIComponent("Selecciona un cliente.")}`);
  }
  if (!fechaEmision) {
    redirect(`${redirectBase}?error=${encodeURIComponent("Selecciona la fecha de emisión.")}`);
  }
  if (tipoEmision === "saldo" && !comprobanteAnticipoId) {
    redirect(
      `${redirectBase}?error=${encodeURIComponent("Selecciona el comprobante de anticipo que estás regularizando.")}`,
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
      `${redirectBase}?error=${encodeURIComponent("Agrega al menos una línea con descripción, cantidad y precio.")}`,
    );
  }

  const { data: cliente } = await supabase
    .from("clientes")
    .select("tipo_documento, numero_documento, nombre, direccion")
    .eq("id", clienteId)
    .single();

  if (!cliente) {
    redirect(`${redirectBase}?error=${encodeURIComponent("Cliente inválido.")}`);
  }

  if (tipoComprobante === 1 && cliente.tipo_documento !== "RUC") {
    redirect(`${redirectBase}?error=${encodeURIComponent("Solo se puede emitir Factura a un cliente con RUC.")}`);
  }

  const documento = cliente.numero_documento.trim();
  const longitudEsperada: Record<string, number> = { DNI: 8, RUC: 11 };
  const esperada = longitudEsperada[cliente.tipo_documento];
  if (esperada && documento.length !== esperada) {
    redirect(
      `${redirectBase}?error=${encodeURIComponent(
        `El ${cliente.tipo_documento} del cliente debe tener ${esperada} dígitos (tiene ${documento.length}: "${documento}"). Corrígelo en Clientes antes de emitir el comprobante.`,
      )}`,
    );
  }

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
        `${redirectBase}?error=${encodeURIComponent("El comprobante de anticipo seleccionado ya no existe.")}`,
      );
    }
    anticipo = anticipoRow;

    const totalesAnticipo = await construirItemsYTotalesLibre(supabase, anticipoRow.id, empresaId);
    if (!totalesAnticipo) {
      redirect(
        `${redirectBase}?error=${encodeURIComponent("No se pudo leer el monto del anticipo seleccionado.")}`,
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
  // producto más, y se referencia el comprobante de anticipo exacto
  // (serie+número) que se está regularizando. Faltaban estos dos campos
  // — con solo el booleano, Nubefact no puede cruzar el descuento contra
  // ningún documento y su backend falla al procesarlo ("undefined
  // method `+' for nil").
  if (anticipo) {
    const lineaAnticipo = totales.items[totales.items.length - 1];
    lineaAnticipo.anticipo_regularizacion = true;
    lineaAnticipo.anticipo_documento_serie = anticipo.serie;
    lineaAnticipo.anticipo_documento_numero = String(anticipo.numero);
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
    observaciones: descripcion ?? undefined,
    moneda: 1,
    porcentaje_de_igv: porcentajeIgv,
    total_gravada: totales.totalGravada,
    total_igv: totales.totalIgv,
    total: totales.total,
    items: totales.items,
  };

  return { clienteId, tipoEmision, anticipo, descripcion, lineas, lineasParaItems, payload };
}

export async function emitirComprobanteLibre(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await requireComprobantesAcceso(supabase);

  const tipoComprobante = Number(formData.get("tipo_comprobante") || 2);

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
  // nace de una venta o de un comprobante libre. Por eso la reserva tiene
  // que ser atómica (siguienteNumeroComprobante): una venta y un
  // comprobante libre pueden emitirse casi al mismo tiempo.
  const numero = await siguienteNumeroComprobante(supabase, {
    empresaId,
    tipoComprobante,
    serie,
    redirectBase: "/comprobantes-libres/nuevo",
  });

  const { clienteId, tipoEmision, anticipo, descripcion, lineas, lineasParaItems, payload } =
    await validarYArmarPayload(supabase, empresaId, formData, {
      tipoComprobante,
      serie,
      numero,
      redirectBase: "/comprobantes-libres/nuevo",
    });

  // Se inserta la fila y se guardan las líneas ANTES de llamar a Nubefact
  // — así, si la emisión falla, lo que se escribió no se pierde: queda un
  // comprobante en "pendiente"/"error" con sus líneas, listo para
  // reintentar desde "Editar" en vez de tener que volver a escribirlo todo.
  const { data: comprobante, error: insertError } = await supabase
    .from("comprobantes")
    .insert({
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
      estado: "pendiente",
    })
    .select("id")
    .single();

  if (insertError || !comprobante) {
    redirect(
      `/comprobantes-libres/nuevo?error=${encodeURIComponent(insertError?.message ?? "No se pudo reservar el comprobante.")}`,
    );
  }

  await guardarDetalleLibre(supabase, comprobante.id, lineas, lineasParaItems, anticipo);

  await reintentarEmision(supabase, {
    comprobanteId: comprobante.id,
    camposActualizar: {},
    payload,
    etiqueta: "el comprobante",
    redirectBase: `/comprobantes-libres/${comprobante.id}/editar`,
  });

  revalidatePath("/comprobantes-libres");
  redirect("/comprobantes-libres?emitido=1");
}

// Edita y reintenta un comprobante libre que quedó en "pendiente" o
// "error" — nunca uno "emitido" (ese ya es un documento real ante SUNAT)
// ni uno "anulado". Reutiliza el mismo tipo+serie+número ya reservados.
export async function editarComprobanteLibre(comprobanteId: string, formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireComprobantesAcceso(supabase);
  const redirectBase = `/comprobantes-libres/${comprobanteId}/editar`;

  const { data: comprobante } = await supabase
    .from("comprobantes")
    .select("id, tipo_comprobante, serie, numero, estado, origen")
    .eq("id", comprobanteId)
    .eq("origen", "libre")
    .single();

  if (!comprobante) {
    redirect(`/comprobantes-libres?error=${encodeURIComponent("El comprobante no existe.")}`);
  }
  if (comprobante.estado !== "pendiente" && comprobante.estado !== "error") {
    redirect(
      `/comprobantes-libres?error=${encodeURIComponent(
        "Este comprobante ya fue emitido o anulado — no se puede editar.",
      )}`,
    );
  }

  const { clienteId, tipoEmision, anticipo, descripcion, lineas, lineasParaItems, payload } =
    await validarYArmarPayload(supabase, empresaId, formData, {
      tipoComprobante: comprobante.tipo_comprobante,
      serie: comprobante.serie,
      numero: comprobante.numero,
      redirectBase,
    });

  await reintentarEmision(supabase, {
    comprobanteId,
    camposActualizar: {
      cliente_id: clienteId,
      tipo_emision: tipoEmision,
      comprobante_anticipo_id: anticipo?.id ?? null,
      descripcion,
    },
    payload,
    etiqueta: "el comprobante",
    redirectBase,
  });

  // Solo se llega hasta acá si el reintento tuvo éxito (reintentarEmision
  // redirige y no vuelve si Nubefact lo rechaza otra vez) — las líneas
  // anteriores (si las hubiera, de un intento previo que sí hubiera
  // llegado a guardarlas) se reemplazan por las que realmente se
  // enviaron esta vez.
  await supabase.from("comprobante_libre_detalle").delete().eq("comprobante_id", comprobanteId);
  await guardarDetalleLibre(supabase, comprobanteId, lineas, lineasParaItems, anticipo);

  revalidatePath("/comprobantes-libres");
  redirect("/comprobantes-libres?emitido=1");
}

// Las líneas quedan guardadas tal cual se enviaron a Nubefact (incluida
// la de descuento del anticipo) — así el detalle en pantalla nunca se
// desincroniza de lo que realmente se declaró.
async function guardarDetalleLibre(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comprobanteId: string,
  lineas: { productoId: string | null; descripcion: string; cantidad: number; precio_unitario: number }[],
  lineasParaItems: { descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }[],
  anticipo: { id: string } | null,
) {
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

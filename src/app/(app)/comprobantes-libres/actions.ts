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
import { tipoDocumentoNubefact, type NubefactItem, type NubefactRequest } from "@/utils/nubefact";

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
  await requireComprobantesAcceso(supabase, "/comprobantes-libres");

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
  // seleccionado — el usuario nunca escribe ese monto a mano, para que
  // no se pueda descuadrar del anticipo real. Confirmado con el ejemplo
  // oficial de Nubefact ("ANTICIPO REGULARIZACION" de su manual JSON):
  // la línea del anticipo se repite con sus valores REALES en positivo
  // (igual que en el comprobante de anticipo original, nunca negativa)
  // marcada con anticipo_regularizacion + anticipo_documento_serie/
  // numero — pero esa línea se RESTA de total_gravada/total_igv/total de
  // la cabecera (no de las líneas), y total_anticipo lleva su importe
  // sin IGV. Antes se mandaba como línea negativa, que SUNAT rechaza
  // ("Item - IGV debe ser mayor que 0.0 ... total debe ser mayor que 0").
  let anticipo:
    | { id: string; tipo_comprobante: number; serie: string; numero: number; totalGravada: number; totalIgv: number; total: number }
    | null = null;
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

    const totalesAnticipo = await construirItemsYTotalesLibre(supabase, anticipoRow.id, empresaId);
    if (!totalesAnticipo) {
      redirect(
        `${redirectBase}?error=${encodeURIComponent("No se pudo leer el monto del anticipo seleccionado.")}`,
      );
    }

    anticipo = {
      ...anticipoRow,
      totalGravada: totalesAnticipo.totalGravada,
      totalIgv: totalesAnticipo.totalIgv,
      total: totalesAnticipo.total,
    };
  }

  const totales = itemsDesdeLineas(lineasParaItems, porcentajeIgv);

  let items = totales.items;
  let totalGravada = totales.totalGravada;
  let totalIgv = totales.totalIgv;
  let total = totales.total;
  let totalAnticipo: number | undefined;

  if (anticipo) {
    const lineaAnticipo: NubefactItem = {
      unidad_de_medida: "NIU",
      descripcion: `Anticipo ${TIPO_COMPROBANTE_LABEL[anticipo.tipo_comprobante]} ${anticipo.serie}-${anticipo.numero}`,
      cantidad: 1,
      valor_unitario: anticipo.totalGravada,
      precio_unitario: anticipo.total,
      subtotal: anticipo.totalGravada,
      tipo_de_igv: 1,
      igv: anticipo.totalIgv,
      total: anticipo.total,
      anticipo_regularizacion: true,
      anticipo_documento_serie: anticipo.serie,
      anticipo_documento_numero: String(anticipo.numero),
    };
    items = [...items, lineaAnticipo];
    totalGravada = Math.round((totalGravada - anticipo.totalGravada) * 100) / 100;
    totalIgv = Math.round((totalIgv - anticipo.totalIgv) * 100) / 100;
    total = Math.round((total - anticipo.total) * 100) / 100;
    totalAnticipo = anticipo.totalGravada;
  }

  const payload: NubefactRequest = {
    operacion: "generar_comprobante",
    tipo_de_comprobante: tipoComprobante,
    serie,
    numero,
    // 4 = VENTA INTERNA - ANTICIPOS, tal como usa Nubefact en sus
    // propios ejemplos tanto para el anticipo como para su regularización.
    sunat_transaction: tipoEmision === "anticipo" || tipoEmision === "saldo" ? 4 : 1,
    cliente_tipo_de_documento: tipoDocumentoNubefact(cliente.tipo_documento),
    cliente_numero_de_documento: cliente.numero_documento,
    cliente_denominacion: cliente.nombre,
    cliente_direccion: cliente.direccion ?? undefined,
    fecha_de_emision: fechaNubefact(fechaEmision),
    observaciones: descripcion ?? undefined,
    moneda: 1,
    porcentaje_de_igv: porcentajeIgv,
    total_gravada: totalGravada,
    total_igv: totalIgv,
    total_anticipo: totalAnticipo,
    total,
    items,
  };

  return { clienteId, tipoEmision, anticipo, descripcion, lineas, lineasParaItems, payload };
}

export async function emitirComprobanteLibre(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await requireComprobantesAcceso(supabase, "/comprobantes-libres");

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
  const { empresaId } = await requireComprobantesAcceso(supabase, "/comprobantes-libres");
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

  // Se reemplaza el detalle ANTES de reintentar — reintentarEmision
  // redirige y no vuelve si Nubefact lo vuelve a rechazar, así que si el
  // guardado quedara después de esa llamada (como estaba antes) las
  // líneas que acabas de escribir se perderían otra vez en cada reintento
  // fallido. Guardándolas antes, quedan ahí pase lo que pase.
  await supabase.from("comprobante_libre_detalle").delete().eq("comprobante_id", comprobanteId);
  await guardarDetalleLibre(supabase, comprobanteId, lineas, lineasParaItems, anticipo);

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

  revalidatePath("/comprobantes-libres");
  redirect("/comprobantes-libres?emitido=1");
}

// Las líneas reales quedan guardadas tal cual se enviaron a Nubefact. La
// línea del anticipo (si la hay) a Nubefact se manda distinto — como un
// item más, en positivo, que la cabecera resta aparte (ver
// validarYArmarPayload) — pero acá en nuestra propia pantalla se guarda
// como lo que realmente es para el usuario: un descuento, en negativo,
// para que el detalle siga mostrando de dónde sale el total a pagar.
async function guardarDetalleLibre(
  supabase: Awaited<ReturnType<typeof createClient>>,
  comprobanteId: string,
  lineas: { productoId: string | null; descripcion: string; cantidad: number; precio_unitario: number }[],
  lineasParaItems: { descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }[],
  anticipo: { tipo_comprobante: number; serie: string; numero: number; total: number } | null,
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
    await supabase.from("comprobante_libre_detalle").insert({
      comprobante_id: comprobanteId,
      producto_id: null,
      descripcion: `Anticipo (-) ${TIPO_COMPROBANTE_LABEL[anticipo.tipo_comprobante]} ${anticipo.serie}-${anticipo.numero}`,
      cantidad: 1,
      precio_unitario: -anticipo.total,
      subtotal: -anticipo.total,
    });
  }
}

// Asociar es solo una referencia de trazabilidad (qué tipo y número de
// documento corresponde a esta venta) — a propósito no valida que el
// monto del comprobante cuadre con el de la venta, tal como se pidió.
export async function asociarComprobanteLibre(ventaId: string, formData: FormData) {
  const supabase = await createClient();
  await requireComprobantesAcceso(supabase, "/comprobantes-libres");

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
  await requireComprobantesAcceso(supabase, "/comprobantes-libres");

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

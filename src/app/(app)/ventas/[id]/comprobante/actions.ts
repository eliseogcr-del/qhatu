"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import {
  construirItemsYTotales,
  fechaDeHoy,
  crearNotaVentaAutomatica,
} from "@/utils/supabase/comprobantes";
import { TIPO_NOTA_VENTA } from "@/lib/comprobante-links";
import {
  llamarNubefact,
  tipoDocumentoNubefact,
  type NubefactRequest,
  type NubefactResponse,
} from "@/utils/nubefact";

// Reserva la fila en comprobantes, llama a Nubefact, y actualiza el
// resultado (o el error) — compartido entre emitir un comprobante nuevo
// y emitir la nota de crédito que anula uno existente. Si algo falla,
// redirige con el mensaje correspondiente y nunca vuelve al llamador.
async function guardarYEmitir(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    empresaId: string;
    userId: string;
    ventaId: string;
    almacenId: string | null;
    tipoComprobante: number;
    serie: string;
    numero: number;
    payload: NubefactRequest;
    etiqueta: string;
  },
) {
  const { empresaId, userId, ventaId, almacenId, tipoComprobante, serie, numero, payload, etiqueta } =
    params;

  const { data: comprobante, error: insertError } = await supabase
    .from("comprobantes")
    .insert({
      empresa_id: empresaId,
      venta_id: ventaId,
      almacen_id: almacenId,
      tipo_comprobante: tipoComprobante,
      serie,
      numero,
      estado: "pendiente",
      usuario_id: userId,
    })
    .select("id")
    .single();

  if (insertError || !comprobante) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent(insertError?.message ?? `No se pudo reservar ${etiqueta}.`)}`,
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
      `/ventas/${ventaId}?error=${encodeURIComponent(`No se pudo conectar con Nubefact: ${errorConexion}`)}`,
    );
  }

  if (respuesta!.errors) {
    await supabase
      .from("comprobantes")
      .update({ estado: "error", error_mensaje: respuesta!.errors })
      .eq("id", comprobante.id);
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent(`Nubefact rechazó ${etiqueta}: ${respuesta!.errors}`)}`,
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
}

export async function emitirComprobante(ventaId: string, formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const tipoComprobante = Number(formData.get("tipo_comprobante") ?? 2);

  const { data: venta } = await supabase
    .from("ventas")
    .select(
      "id, total, moneda, estado, almacen_id, clientes(tipo_documento, numero_documento, nombre, direccion)",
    )
    .eq("id", ventaId)
    .single();

  if (!venta) redirect(`/ventas/${ventaId}`);

  if (venta.estado === "anulada") {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("No se puede emitir un comprobante de una venta anulada.")}`,
    );
  }

  const cliente = venta.clientes as unknown as {
    tipo_documento: string;
    numero_documento: string;
    nombre: string;
    direccion: string | null;
  } | null;

  if (!cliente) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("La venta no tiene cliente asociado.")}`,
    );
  }

  if (tipoComprobante === 1 && cliente.tipo_documento !== "RUC") {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("Solo se puede emitir Factura a un cliente con RUC.")}`,
    );
  }

  const documento = cliente.numero_documento.trim();
  const longitudEsperada: Record<string, number> = { DNI: 8, RUC: 11 };
  const esperada = longitudEsperada[cliente.tipo_documento];
  if (esperada && documento.length !== esperada) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent(
        `El ${cliente.tipo_documento} del cliente debe tener ${esperada} dígitos (tiene ${documento.length}: "${documento}"). Corrígelo en Clientes antes de emitir el comprobante.`,
      )}`,
    );
  }

  const totales = await construirItemsYTotales(supabase, ventaId);
  if (!totales) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("La venta no tiene productos entregados para facturar.")}`,
    );
  }

  const { data: config } = await supabase
    .from("configuracion_facturacion")
    .select("serie_factura, serie_boleta")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!config) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent(
        "Falta configurar las series de facturación. Ve a Administración → Facturación electrónica.",
      )}`,
    );
  }

  const serie = tipoComprobante === 1 ? config.serie_factura : config.serie_boleta;
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
    fecha_de_emision: fechaDeHoy(),
    moneda: venta.moneda === "USD" ? 2 : 1,
    porcentaje_de_igv: 18.0,
    total_gravada: totales.totalGravada,
    total_igv: totales.totalIgv,
    total: totales.total,
    items: totales.items,
  };

  await guardarYEmitir(supabase, {
    empresaId,
    userId,
    ventaId,
    almacenId: venta.almacen_id,
    tipoComprobante,
    serie,
    numero,
    payload,
    etiqueta: "el comprobante",
  });

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/comprobantes");
  redirect(`/ventas/${ventaId}`);
}

// Anular un comprobante ya emitido y aceptado por SUNAT no se hace con
// una simple anulación local — se emite una Nota de Crédito que lo
// referencia (motivo "Anulación de la operación"), por el mismo total.
// El comprobante original solo se marca como anulado en nuestro sistema
// una vez que Nubefact aceptó la nota de crédito de verdad.
export async function anularComprobante(comprobanteId: string, ventaId: string) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const { data: original } = await supabase
    .from("comprobantes")
    .select("id, tipo_comprobante, serie, numero, estado")
    .eq("id", comprobanteId)
    .single();

  if (!original || original.estado !== "emitido") {
    redirect(`/ventas/${ventaId}`);
  }

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, moneda, almacen_id, clientes(tipo_documento, numero_documento, nombre, direccion)")
    .eq("id", ventaId)
    .single();

  if (!venta) redirect(`/ventas/${ventaId}`);

  const cliente = venta.clientes as unknown as {
    tipo_documento: string;
    numero_documento: string;
    nombre: string;
    direccion: string | null;
  } | null;

  if (!cliente) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("La venta no tiene cliente asociado.")}`,
    );
  }

  const totales = await construirItemsYTotales(supabase, ventaId);
  if (!totales) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("No se encontraron los productos originales para armar la nota de crédito.")}`,
    );
  }

  const { data: config } = await supabase
    .from("configuracion_facturacion")
    .select("serie_factura, serie_boleta")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!config) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent(
        "Falta configurar las series de facturación. Ve a Administración → Facturación electrónica.",
      )}`,
    );
  }

  const serieNota = original.tipo_comprobante === 1 ? config.serie_factura : config.serie_boleta;
  const { data: ultimaNota } = await supabase
    .from("comprobantes")
    .select("numero")
    .eq("empresa_id", empresaId)
    .eq("tipo_comprobante", 3)
    .eq("serie", serieNota)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  const numeroNota = (ultimaNota?.numero ?? 0) + 1;

  const payload: NubefactRequest = {
    operacion: "generar_comprobante",
    tipo_de_comprobante: 3,
    serie: serieNota,
    numero: numeroNota,
    sunat_transaction: 1,
    cliente_tipo_de_documento: tipoDocumentoNubefact(cliente.tipo_documento),
    cliente_numero_de_documento: cliente.numero_documento,
    cliente_denominacion: cliente.nombre,
    cliente_direccion: cliente.direccion ?? undefined,
    fecha_de_emision: fechaDeHoy(),
    moneda: venta.moneda === "USD" ? 2 : 1,
    porcentaje_de_igv: 18.0,
    total_gravada: totales.totalGravada,
    total_igv: totales.totalIgv,
    total: totales.total,
    items: totales.items,
    documento_que_se_modifica_tipo: original.tipo_comprobante,
    documento_que_se_modifica_serie: original.serie,
    documento_que_se_modifica_numero: original.numero,
    tipo_de_nota_de_credito: 1, // Anulación de la operación (catálogo 09 SUNAT)
  };

  await guardarYEmitir(supabase, {
    empresaId,
    userId,
    ventaId,
    almacenId: venta.almacen_id,
    tipoComprobante: 3,
    serie: serieNota,
    numero: numeroNota,
    payload,
    etiqueta: "la nota de crédito",
  });

  // Solo llega hasta acá si la nota de crédito se emitió y fue aceptada
  // (guardarYEmitir redirige antes en cualquier caso de error).
  await supabase.from("comprobantes").update({ estado: "anulado" }).eq("id", comprobanteId);

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/comprobantes");
  redirect(`/ventas/${ventaId}`);
}

// Nota de venta: documento interno, no pasa por Nubefact/SUNAT — se
// registra directamente como "emitido", sin llamar a ningún proveedor
// externo. La numeración usa una serie propia por almacén
// (series_nota_venta), no la de configuracion_facturacion.
export async function emitirNotaVenta(ventaId: string) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, estado, almacen_id")
    .eq("id", ventaId)
    .single();

  if (!venta) redirect(`/ventas/${ventaId}`);

  if (venta.estado === "anulada") {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("No se puede emitir una nota de venta de una venta anulada.")}`,
    );
  }

  const totales = await construirItemsYTotales(supabase, ventaId);
  if (!totales) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("La venta no tiene productos entregados.")}`,
    );
  }

  const { error } = await crearNotaVentaAutomatica(supabase, {
    empresaId,
    userId,
    ventaId,
    almacenId: venta.almacen_id,
  });

  if (error) {
    redirect(`/ventas/${ventaId}?error=${encodeURIComponent(error)}`);
  }

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/comprobantes");
  redirect(`/ventas/${ventaId}`);
}

// Anular una nota de venta es solo un cambio de estado local — al no ser
// un documento SUNAT no hace falta ninguna nota de crédito ni llamada
// externa para revertirla.
export async function anularNotaVenta(comprobanteId: string, ventaId: string) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  const { error } = await supabase
    .from("comprobantes")
    .update({ estado: "anulado" })
    .eq("id", comprobanteId)
    .eq("tipo_comprobante", TIPO_NOTA_VENTA);

  if (error) {
    redirect(`/ventas/${ventaId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/comprobantes");
  redirect(`/ventas/${ventaId}`);
}

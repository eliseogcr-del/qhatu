"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import {
  construirItemsYTotales,
  fechaDeHoy,
  crearNotaVentaAutomatica,
  guardarYEmitir,
} from "@/utils/supabase/comprobantes";
import { TIPO_NOTA_VENTA } from "@/lib/comprobante-links";
import { registrarAuditoria, TIPO_AUDITORIA } from "@/utils/supabase/auditoria";
import { tipoDocumentoNubefact, type NubefactRequest } from "@/utils/nubefact";

// guardarYEmitir (reserva la fila, llama a Nubefact, guarda el resultado
// o el error) vive en utils/supabase/comprobantes.ts — la comparten esta
// pantalla (comprobante de venta + su nota de crédito) y el módulo de
// Comprobantes libres.

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

  const totales = await construirItemsYTotales(supabase, ventaId, empresaId);
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
    porcentaje_de_igv: totales.porcentajeIgv,
    total_gravada: totales.totalGravada,
    total_igv: totales.totalIgv,
    total: totales.total,
    items: totales.items,
  };

  await guardarYEmitir(supabase, {
    insert: {
      empresa_id: empresaId,
      usuario_id: userId,
      venta_id: ventaId,
      almacen_id: venta.almacen_id,
      tipo_comprobante: tipoComprobante,
      serie,
      numero,
    },
    payload,
    etiqueta: "el comprobante",
    redirectBase: `/ventas/${ventaId}`,
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

  const totales = await construirItemsYTotales(supabase, ventaId, empresaId);
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
    porcentaje_de_igv: totales.porcentajeIgv,
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
    insert: {
      empresa_id: empresaId,
      usuario_id: userId,
      venta_id: ventaId,
      almacen_id: venta.almacen_id,
      tipo_comprobante: 3,
      serie: serieNota,
      numero: numeroNota,
    },
    payload,
    etiqueta: "la nota de crédito",
    redirectBase: `/ventas/${ventaId}`,
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

  const totales = await construirItemsYTotales(supabase, ventaId, empresaId);
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
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const { data: notaVenta } = await supabase
    .from("comprobantes")
    .select("serie, numero")
    .eq("id", comprobanteId)
    .eq("tipo_comprobante", TIPO_NOTA_VENTA)
    .single();

  const { error } = await supabase
    .from("comprobantes")
    .update({ estado: "anulado" })
    .eq("id", comprobanteId)
    .eq("tipo_comprobante", TIPO_NOTA_VENTA);

  if (error) {
    redirect(`/ventas/${ventaId}?error=${encodeURIComponent(error.message)}`);
  }

  // A diferencia de una Boleta/Factura, esto es solo un cambio de estado
  // local (no hay nota de crédito de por medio) — por eso, sin este
  // registro, no quedaba ningún rastro de quién la anuló ni cuándo.
  await registrarAuditoria(supabase, {
    empresaId,
    usuarioId: userId,
    entidad: "venta",
    entidadId: ventaId,
    tipoMovimiento: TIPO_AUDITORIA.notaVentaAnular,
    detalle: notaVenta ? `Anuló la nota de venta ${notaVenta.serie}-${notaVenta.numero}.` : null,
  });

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/comprobantes");
  redirect(`/ventas/${ventaId}`);
}

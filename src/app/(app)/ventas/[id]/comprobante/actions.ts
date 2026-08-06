"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import {
  llamarNubefact,
  tipoDocumentoNubefact,
  type NubefactItem,
  type NubefactResponse,
} from "@/utils/nubefact";

// Series asignadas por Nubefact a esta cuenta (panel Locales → Local
// principal → "Tipos de comprobantes y series asignados").
const SERIE_POR_TIPO: Record<number, string> = { 1: "FFF1", 2: "BBB1" };
const PORCENTAJE_IGV = 0.18;

export async function emitirComprobante(ventaId: string, formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const tipoComprobante = Number(formData.get("tipo_comprobante") ?? 2);

  const { data: venta } = await supabase
    .from("ventas")
    .select(
      "id, total, moneda, estado, clientes(tipo_documento, numero_documento, nombre, direccion)",
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

  const { data: detalle } = await supabase
    .from("venta_detalle")
    .select("cantidad_entregada, precio_unitario, subtotal, productos(nombre)")
    .eq("venta_id", ventaId)
    .gt("cantidad_entregada", 0);

  if (!detalle || detalle.length === 0) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("La venta no tiene productos entregados para facturar.")}`,
    );
  }

  const serie = SERIE_POR_TIPO[tipoComprobante] ?? "B001";
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

  const items: NubefactItem[] = detalle.map((d) => {
    const valorUnitario = Math.round((d.precio_unitario / (1 + PORCENTAJE_IGV)) * 100) / 100;
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

  const hoy = new Date();
  const fechaEmision = `${String(hoy.getDate()).padStart(2, "0")}-${String(
    hoy.getMonth() + 1,
  ).padStart(2, "0")}-${hoy.getFullYear()}`;

  const payload = {
    operacion: "generar_comprobante",
    tipo_de_comprobante: tipoComprobante,
    serie,
    numero,
    sunat_transaction: 1,
    cliente_tipo_de_documento: tipoDocumentoNubefact(cliente.tipo_documento),
    cliente_numero_de_documento: cliente.numero_documento,
    cliente_denominacion: cliente.nombre,
    cliente_direccion: cliente.direccion ?? undefined,
    fecha_de_emision: fechaEmision,
    moneda: venta.moneda === "USD" ? 2 : 1,
    porcentaje_de_igv: 18.0,
    total_gravada: totalGravada,
    total_igv: totalIgv,
    total,
    items,
  };

  const { data: comprobante, error: insertError } = await supabase
    .from("comprobantes")
    .insert({
      empresa_id: empresaId,
      venta_id: ventaId,
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
      `/ventas/${ventaId}?error=${encodeURIComponent(insertError?.message ?? "No se pudo reservar el comprobante.")}`,
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
      `/ventas/${ventaId}?error=${encodeURIComponent(`Nubefact rechazó el comprobante: ${respuesta!.errors}`)}`,
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

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/comprobantes");
  redirect(`/ventas/${ventaId}`);
}

// Anular un comprobante ya emitido — genera una nota de crédito en
// Nubefact. Por ahora solo se deja el registro marcado como anulado;
// la generación de la nota de crédito queda para cuando se necesite.
export async function anularComprobante(comprobanteId: string, ventaId: string) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  await supabase
    .from("comprobantes")
    .update({ estado: "anulado" })
    .eq("id", comprobanteId);

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/comprobantes");
  redirect(`/ventas/${ventaId}`);
}

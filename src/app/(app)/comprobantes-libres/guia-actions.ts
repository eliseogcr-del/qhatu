"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import { construirDatosGuiaRemitenteLibre } from "@/utils/supabase/guias-remision";
import { llamarNubefact, type NubefactGuiaRemitenteRequest, type NubefactGuiaResponse } from "@/utils/nubefact";

// Mismo flujo que generarGuiaRemision (Repartos), pero armando los datos
// de transporte a partir del formulario en vez de leerlos de `repartos`
// — un comprobante libre no tiene reparto/pedido detrás.
export async function generarGuiaRemisionLibre(comprobanteId: string, formData: FormData) {
  const supabase = await createClient();
  const { empresaId, userId } = await requireComprobantesAcceso(supabase, "/comprobantes-libres");
  const redirectBase = `/comprobantes-libres/${comprobanteId}`;

  const { data: yaExiste } = await supabase
    .from("guias_remision")
    .select("id")
    .eq("comprobante_id", comprobanteId)
    .maybeSingle();

  if (yaExiste) {
    redirect(`${redirectBase}?error=${encodeURIComponent("Este comprobante ya tiene una guía de remisión generada.")}`);
  }

  const almacenId = String(formData.get("almacen_id") || "");
  const tipoTransporte = String(formData.get("tipo_transporte") || "repartidor_propio");
  const placaNumero = String(formData.get("placa_numero") || "").trim();
  const pesoBrutoTotal = Number(formData.get("peso_bruto_total") || 0);
  const numeroDeBultos = Number(formData.get("numero_de_bultos") || 0);
  const transportistaNombre = String(formData.get("transportista_nombre") || "").trim() || null;
  const transportistaRuc = String(formData.get("transportista_ruc") || "").trim() || null;
  const repartidorId = String(formData.get("repartidor_id") || "") || null;

  if (!almacenId) {
    redirect(`${redirectBase}?error=${encodeURIComponent("Selecciona el almacén de origen del traslado.")}`);
  }

  const resultado = await construirDatosGuiaRemitenteLibre(supabase, {
    comprobanteId,
    almacenId,
    tipoTransporte,
    placaNumero,
    pesoBrutoTotal,
    numeroDeBultos,
    transportistaNombre,
    transportistaRuc,
    repartidorId,
  });
  if ("error" in resultado) {
    redirect(`${redirectBase}?error=${encodeURIComponent(resultado.error)}`);
  }

  const { data: config } = await supabase
    .from("configuracion_facturacion")
    .select("serie_guia_remision")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!config) {
    redirect(
      `${redirectBase}?error=${encodeURIComponent(
        "Falta configurar la serie de guía de remisión. Ve a Administración → Facturación electrónica.",
      )}`,
    );
  }

  const serie = config.serie_guia_remision;
  // Reserva atómica — misma función ya usada para comprobantes/nota de
  // venta/cotizaciones/guía de reparto (tipo_comprobante 7 = guía, ambos
  // orígenes comparten la misma serie y por lo tanto el mismo contador).
  const { data: numero, error: numeroError } = await supabase.rpc("siguiente_numero_comprobante", {
    p_empresa_id: empresaId,
    p_tipo_comprobante: 7,
    p_serie: serie,
  });

  if (numeroError || numero === null) {
    redirect(
      `${redirectBase}?error=${encodeURIComponent(numeroError?.message ?? "No se pudo reservar el número de la guía.")}`,
    );
  }

  const { data: guia, error: insertError } = await supabase
    .from("guias_remision")
    .insert({
      empresa_id: empresaId,
      comprobante_id: comprobanteId,
      almacen_id: almacenId,
      tipo_comprobante: 7,
      serie,
      numero,
      estado: "pendiente",
      usuario_id: userId,
      tipo_transporte: tipoTransporte,
      placa_numero: placaNumero,
      peso_bruto_total: pesoBrutoTotal,
      numero_de_bultos: numeroDeBultos,
      transportista_nombre: transportistaNombre,
      transportista_ruc: transportistaRuc,
      repartidor_id: repartidorId,
    })
    .select("id")
    .single();

  if (insertError || !guia) {
    redirect(
      `${redirectBase}?error=${encodeURIComponent(insertError?.message ?? "No se pudo reservar la guía.")}`,
    );
  }

  const payload: NubefactGuiaRemitenteRequest = {
    operacion: "generar_guia",
    tipo_de_comprobante: 7,
    serie,
    numero: String(numero),
    ...resultado.datos,
  };

  let respuesta: NubefactGuiaResponse | null = null;
  let errorConexion: string | null = null;
  try {
    respuesta = await llamarNubefact<NubefactGuiaRemitenteRequest, NubefactGuiaResponse>(payload);
  } catch (err) {
    errorConexion =
      err instanceof Error ? err.message : "Error desconocido al conectar con Nubefact.";
  }

  if (errorConexion) {
    await supabase
      .from("guias_remision")
      .update({ estado: "error", error_mensaje: errorConexion })
      .eq("id", guia.id);
    redirect(`${redirectBase}?error=${encodeURIComponent(`No se pudo conectar con Nubefact: ${errorConexion}`)}`);
  }

  if (respuesta!.errors) {
    await supabase
      .from("guias_remision")
      .update({ estado: "error", error_mensaje: respuesta!.errors })
      .eq("id", guia.id);
    redirect(`${redirectBase}?error=${encodeURIComponent(`Nubefact rechazó la guía: ${respuesta!.errors}`)}`);
  }

  await supabase
    .from("guias_remision")
    .update({ sunat_description: respuesta!.sunat_description ?? null })
    .eq("id", guia.id);

  revalidatePath(redirectBase);
  redirect(`${redirectBase}?guia_generada=1`);
}

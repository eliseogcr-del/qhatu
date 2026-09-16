"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { ESTADOS_REPARTO, type EstadoReparto } from "@/lib/reparto-estados";
import { construirDatosGuiaRemitente } from "@/utils/supabase/guias-remision";
import {
  llamarNubefact,
  type NubefactGuiaRemitenteRequest,
  type NubefactGuiaResponse,
  type NubefactConsultarGuiaRequest,
} from "@/utils/nubefact";

function repartoFromForm(formData: FormData) {
  const text = (key: string) => {
    const raw = formData.get(key);
    return raw === null || raw === "" ? null : String(raw);
  };
  const num = (key: string) => {
    const raw = formData.get(key);
    if (raw === null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  return {
    pedido_id: String(formData.get("pedido_id") ?? ""),
    fecha_reparto: text("fecha_reparto"),
    tipo_transporte: String(formData.get("tipo_transporte") ?? "repartidor_propio"),
    transportista_nombre: text("transportista_nombre"),
    repartidor_id: text("repartidor_id"),
    estado: String(formData.get("estado") ?? "pendiente"),
    placa_numero: text("placa_numero"),
    peso_bruto_total: num("peso_bruto_total"),
    numero_de_bultos: num("numero_de_bultos"),
    transportista_ruc: text("transportista_ruc"),
  };
}

export async function createReparto(formData: FormData) {
  const supabase = await createClient();
  const { empresaId: empresa_id } = await getEmpresaSession(supabase);
  const reparto = repartoFromForm(formData);

  const { error } = await supabase
    .from("repartos")
    .insert({ ...reparto, empresa_id });

  if (error) {
    redirect(`/repartos/nuevo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/repartos");
  redirect("/repartos");
}

export async function updateReparto(id: string, formData: FormData) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);
  const reparto = repartoFromForm(formData);

  const { error } = await supabase
    .from("repartos")
    .update(reparto)
    .eq("id", id);

  if (error) {
    redirect(
      `/repartos/${id}/editar?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/repartos");
  revalidatePath(`/repartos/${id}/editar`);
  redirect("/repartos");
}

// Acción angosta pensada para el repartidor: solo toca el estado, nunca
// reasigna el pedido, el transporte ni el repartidor — a diferencia de
// updateReparto (edición completa, reservada a admin/logística/vendedor).
export async function actualizarEstadoReparto(id: string, estado: string) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  if (!ESTADOS_REPARTO.includes(estado as EstadoReparto)) {
    throw new Error("Estado inválido.");
  }

  const { error } = await supabase.from("repartos").update({ estado }).eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/mis-repartos");
  revalidatePath("/repartos");
}

// Emite la Guía de Remisión Remitente de un reparto. Ojo: a diferencia de
// factura/boleta, "generar_guia" NUNCA trae el PDF/XML en la misma
// respuesta — la Sunat valida la guía de forma asíncrona, así que queda
// "pendiente" hasta que alguien la consulte con consultarGuiaRemision
// (puede tardar segundos o minutos del lado de Nubefact/Sunat).
export async function generarGuiaRemision(repartoId: string) {
  const supabase = await createClient();
  const { empresaId, userId } = await getEmpresaSession(supabase);

  const { data: yaExiste } = await supabase
    .from("guias_remision")
    .select("id")
    .eq("reparto_id", repartoId)
    .maybeSingle();

  if (yaExiste) {
    redirect(
      `/repartos/${repartoId}/editar?error=${encodeURIComponent("Este reparto ya tiene una guía de remisión generada.")}`,
    );
  }

  const resultado = await construirDatosGuiaRemitente(supabase, repartoId);
  if ("error" in resultado) {
    redirect(`/repartos/${repartoId}/editar?error=${encodeURIComponent(resultado.error)}`);
  }

  const { data: config } = await supabase
    .from("configuracion_facturacion")
    .select("serie_guia_remision")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!config) {
    redirect(
      `/repartos/${repartoId}/editar?error=${encodeURIComponent(
        "Falta configurar la serie de guía de remisión. Ve a Administración → Facturación electrónica.",
      )}`,
    );
  }

  const serie = config.serie_guia_remision;
  const { data: ultima } = await supabase
    .from("guias_remision")
    .select("numero")
    .eq("empresa_id", empresaId)
    .eq("serie", serie)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  const numero = (ultima?.numero ?? 0) + 1;

  const { data: guia, error: insertError } = await supabase
    .from("guias_remision")
    .insert({
      empresa_id: empresaId,
      reparto_id: repartoId,
      tipo_comprobante: 7,
      serie,
      numero,
      estado: "pendiente",
      usuario_id: userId,
    })
    .select("id")
    .single();

  if (insertError || !guia) {
    redirect(
      `/repartos/${repartoId}/editar?error=${encodeURIComponent(
        insertError?.message ?? "No se pudo reservar la guía.",
      )}`,
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
    redirect(
      `/repartos/${repartoId}/editar?error=${encodeURIComponent(`No se pudo conectar con Nubefact: ${errorConexion}`)}`,
    );
  }

  if (respuesta!.errors) {
    await supabase
      .from("guias_remision")
      .update({ estado: "error", error_mensaje: respuesta!.errors })
      .eq("id", guia.id);
    redirect(
      `/repartos/${repartoId}/editar?error=${encodeURIComponent(`Nubefact rechazó la guía: ${respuesta!.errors}`)}`,
    );
  }

  await supabase
    .from("guias_remision")
    .update({ sunat_description: respuesta!.sunat_description ?? null })
    .eq("id", guia.id);

  revalidatePath(`/repartos/${repartoId}/editar`);
  redirect(`/repartos/${repartoId}/editar?guia_generada=1`);
}

// La Sunat valida la GRE de forma asíncrona — este botón se puede tocar
// las veces que haga falta hasta que "aceptada_por_sunat" llegue en true
// (recién ahí Nubefact entrega el PDF/XML/CDR).
export async function consultarGuiaRemision(guiaId: string, repartoId: string) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  const { data: guia } = await supabase
    .from("guias_remision")
    .select("id, tipo_comprobante, serie, numero")
    .eq("id", guiaId)
    .single();

  if (!guia) redirect(`/repartos/${repartoId}/editar`);

  const payload: NubefactConsultarGuiaRequest = {
    operacion: "consultar_guia",
    tipo_de_comprobante: guia.tipo_comprobante,
    serie: guia.serie,
    numero: String(guia.numero),
  };

  let respuesta: NubefactGuiaResponse | null = null;
  let errorConexion: string | null = null;
  try {
    respuesta = await llamarNubefact<NubefactConsultarGuiaRequest, NubefactGuiaResponse>(payload);
  } catch (err) {
    errorConexion =
      err instanceof Error ? err.message : "Error desconocido al conectar con Nubefact.";
  }

  if (errorConexion) {
    redirect(
      `/repartos/${repartoId}/editar?error=${encodeURIComponent(`No se pudo conectar con Nubefact: ${errorConexion}`)}`,
    );
  }

  if (respuesta!.errors) {
    redirect(`/repartos/${repartoId}/editar?error=${encodeURIComponent(`Nubefact: ${respuesta!.errors}`)}`);
  }

  const aceptada = respuesta!.aceptada_por_sunat === true;
  const estado = aceptada ? "aceptada" : respuesta!.sunat_description ? "rechazada" : "pendiente";

  await supabase
    .from("guias_remision")
    .update({
      estado,
      aceptado_por_sunat: respuesta!.aceptada_por_sunat ?? null,
      sunat_description: respuesta!.sunat_description ?? null,
      enlace_pdf: respuesta!.enlace_del_pdf ?? null,
      enlace_xml: respuesta!.enlace_del_xml ?? null,
      enlace_cdr: respuesta!.enlace_del_cdr ?? null,
    })
    .eq("id", guiaId);

  revalidatePath(`/repartos/${repartoId}/editar`);
  redirect(`/repartos/${repartoId}/editar`);
}

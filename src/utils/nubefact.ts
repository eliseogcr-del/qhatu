// Cliente mínimo para la API de Nubefact (facturación electrónica).
// Documentación: https://www.nubefact.com/integracion — nosotros solo
// armamos el JSON y leemos la respuesta; Nubefact genera el PDF/XML, lo
// envía a SUNAT y guarda el CDR.

export type NubefactItem = {
  unidad_de_medida: string;
  codigo_producto_sunat?: string;
  descripcion: string;
  cantidad: number;
  valor_unitario: number;
  precio_unitario: number;
  subtotal: number;
  tipo_de_igv: number;
  igv: number;
  total: number;
  anticipo_regularizacion: boolean;
};

export type NubefactRequest = {
  operacion: string;
  tipo_de_comprobante: number;
  serie: string;
  numero: number;
  sunat_transaction: number;
  cliente_tipo_de_documento: string;
  cliente_numero_de_documento: string;
  cliente_denominacion: string;
  cliente_direccion?: string;
  fecha_de_emision: string;
  moneda: number;
  porcentaje_de_igv: number;
  total_gravada: number;
  total_igv: number;
  total: number;
  items: NubefactItem[];
  [key: string]: unknown;
};

export type NubefactResponse = {
  tipo_de_comprobante?: number;
  serie?: string;
  numero?: number;
  enlace?: string;
  enlace_del_pdf?: string;
  enlace_del_xml?: string;
  enlace_del_cdr?: string;
  aceptada_por_sunat?: boolean;
  sunat_description?: string;
  sunat_responsecode?: string;
  errors?: string;
  codigo?: number;
};

export const TIPO_COMPROBANTE_LABEL: Record<number, string> = {
  1: "Factura",
  2: "Boleta",
  3: "Nota de Crédito",
  4: "Nota de Débito",
  7: "Guía de Remisión Remitente",
  8: "Guía de Remisión Transportista",
};

// Guía de Remisión Remitente Electrónica (GRE) — tipo_de_comprobante 7.
// A diferencia de factura/boleta, Nubefact NUNCA devuelve el PDF/XML en la
// misma respuesta de "generar_guia" (la Sunat valida la guía de forma
// asíncrona): hay que consultarla después con "consultar_guia" para recién
// ahí obtener los enlaces, una vez aceptada. Los campos numéricos van como
// string porque así los muestra el propio manual de Nubefact para GRE
// (a diferencia de factura/boleta, que sí usan JSON number).
export type NubefactGuiaItem = {
  unidad_de_medida: string;
  codigo?: string;
  descripcion: string;
  cantidad: string;
};

export type NubefactDocumentoRelacionado = {
  tipo: string; // 01 Factura, 03 Boleta (catálogo Nubefact, no el de comprobantes normal)
  serie: string;
  numero: string;
};

export type NubefactGuiaRemitenteRequest = {
  operacion: "generar_guia";
  tipo_de_comprobante: 7;
  serie: string;
  numero: string;
  cliente_tipo_de_documento: number; // catálogo 06 SUNAT — acá se refiere al DESTINATARIO
  cliente_numero_de_documento: string;
  cliente_denominacion: string;
  cliente_direccion: string;
  cliente_email?: string;
  fecha_de_emision: string;
  observaciones?: string;
  motivo_de_traslado: string; // "01" = Venta (el único motivo que usamos)
  peso_bruto_total: string;
  peso_bruto_unidad_de_medida: string; // "KGM"
  numero_de_bultos: string;
  tipo_de_transporte: string; // "01" público | "02" privado
  fecha_de_inicio_de_traslado: string;
  fecha_de_entrega_al_transportista?: string; // solo si tipo_de_transporte = "01"
  // Transportista: solo cuando tipo_de_transporte = "01" (público).
  transportista_documento_tipo?: string;
  transportista_documento_numero?: string;
  transportista_denominacion?: string;
  transportista_placa_numero: string;
  // Conductor: solo cuando tipo_de_transporte = "02" (privado).
  conductor_documento_tipo?: string;
  conductor_documento_numero?: string;
  conductor_nombre?: string;
  conductor_apellidos?: string;
  conductor_numero_licencia?: string;
  punto_de_partida_ubigeo: string;
  punto_de_partida_direccion: string;
  punto_de_llegada_ubigeo: string;
  punto_de_llegada_direccion: string;
  enviar_automaticamente_al_cliente: "true" | "false";
  formato_de_pdf?: string;
  items: NubefactGuiaItem[];
  documento_relacionado?: NubefactDocumentoRelacionado[];
};

export type NubefactConsultarGuiaRequest = {
  operacion: "consultar_guia";
  tipo_de_comprobante: number;
  serie: string;
  numero: string;
};

export type NubefactGuiaResponse = {
  nota_importante?: string;
  tipo_de_comprobante?: number;
  serie?: string;
  numero?: number;
  enlace?: string;
  aceptada_por_sunat?: boolean;
  sunat_description?: string | null;
  sunat_note?: string | null;
  sunat_responsecode?: string | null;
  sunat_soap_error?: string | null;
  cadena_para_codigo_qr?: string;
  enlace_del_pdf?: string;
  enlace_del_xml?: string;
  enlace_del_cdr?: string;
  errors?: string;
};

// Catálogo 06 de SUNAT (tipo de documento de identidad).
export function tipoDocumentoNubefact(tipoDocumentoCliente: string): string {
  switch (tipoDocumentoCliente) {
    case "RUC":
      return "6";
    case "DNI":
      return "1";
    case "CE":
      return "4";
    default:
      return "-"; // Varios / sin documento
  }
}

// Genérico en el payload/respuesta para poder reutilizarlo con la Guía de
// Remisión (forma de JSON bastante distinta a factura/boleta/nota) sin
// duplicar la llamada HTTP — el uso normal (factura/boleta/nota) sigue
// funcionando igual porque TReq/TRes caen por defecto en los tipos de
// siempre.
export async function llamarNubefact<
  TReq extends Record<string, unknown> = NubefactRequest,
  TRes = NubefactResponse,
>(payload: TReq): Promise<TRes> {
  const apiUrl = process.env.NUBEFACT_API_URL;
  const token = process.env.NUBEFACT_TOKEN;

  if (!apiUrl || !token) {
    throw new Error(
      "Falta configurar NUBEFACT_API_URL y NUBEFACT_TOKEN en las variables de entorno.",
    );
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as TRes;
  return data;
}

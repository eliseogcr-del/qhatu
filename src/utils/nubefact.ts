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

export async function llamarNubefact(
  payload: NubefactRequest,
): Promise<NubefactResponse> {
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

  const data = (await res.json()) as NubefactResponse;
  return data;
}

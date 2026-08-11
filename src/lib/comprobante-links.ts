import { TIPO_COMPROBANTE_LABEL as TIPO_COMPROBANTE_LABEL_NUBEFACT } from "@/utils/nubefact";

// Código interno para la nota de venta — fuera del catálogo SUNAT (1-4)
// que usan Nubefact/Factura/Boleta/NC/ND, así reaprovecha la misma tabla
// `comprobantes` sin mezclarse con esos tipos.
export const TIPO_NOTA_VENTA = 9;

export const TIPO_COMPROBANTE_LABEL: Record<number, string> = {
  ...TIPO_COMPROBANTE_LABEL_NUBEFACT,
  [TIPO_NOTA_VENTA]: "Nota de venta",
};

// La nota de venta no tiene enlace_pdf en BD (no la genera Nubefact) — se
// imprime desde una página propia de la app. El resto de tipos siguen
// usando el enlace que Nubefact devolvió.
export function enlacePdfComprobante(c: {
  id: string;
  tipo_comprobante: number;
  enlace_pdf: string | null;
}): string | null {
  if (c.tipo_comprobante === TIPO_NOTA_VENTA) return `/comprobantes/nota-venta/${c.id}`;
  return c.enlace_pdf;
}

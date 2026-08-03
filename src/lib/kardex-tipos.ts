export const TIPOS_MOVIMIENTO = ["compra", "venta", "ajuste", "merma"] as const;

export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const TIPO_MOVIMIENTO_LABEL: Record<TipoMovimiento, string> = {
  compra: "Compra",
  venta: "Venta",
  ajuste: "Ajuste",
  merma: "Merma",
};

// Tipos que el usuario puede registrar manualmente. "venta" y "merma" solo
// se generan automáticamente al registrar una venta, para no romper la
// trazabilidad con venta_detalle/devoluciones.
export const TIPOS_MOVIMIENTO_MANUAL = ["compra", "ajuste"] as const;

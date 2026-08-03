export const METODOS_PAGO = [
  "efectivo",
  "yape",
  "plin",
  "transferencia",
  "otro",
] as const;

export type MetodoPago = (typeof METODOS_PAGO)[number];

export const METODO_PAGO_LABEL: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
  otro: "Otro",
};

export const TIPO_PAGO_LABEL: Record<string, string> = {
  anticipo: "Anticipo",
  pago: "Pago",
};

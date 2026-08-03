export const TIPOS_DEVOLUCION = [
  "danado",
  "malogrado",
  "vencido",
  "error_pedido",
  "otro",
] as const;

export type TipoDevolucion = (typeof TIPOS_DEVOLUCION)[number];

export const TIPO_DEVOLUCION_LABEL: Record<TipoDevolucion, string> = {
  danado: "Dañado",
  malogrado: "Malogrado",
  vencido: "Vencido",
  error_pedido: "Error en el pedido",
  otro: "Otro",
};

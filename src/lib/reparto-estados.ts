export const ESTADOS_REPARTO = [
  "pendiente",
  "en_curso",
  "completado",
  "cancelado",
] as const;

export type EstadoReparto = (typeof ESTADOS_REPARTO)[number];

export const ESTADO_REPARTO_LABEL: Record<EstadoReparto, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export const ESTADO_REPARTO_BADGE: Record<EstadoReparto, string> = {
  pendiente: "bg-yellow-100 text-yellow-700",
  en_curso: "bg-purple-100 text-purple-700",
  completado: "bg-green-100 text-green-700",
  cancelado: "bg-red-100 text-red-700",
};

export const TIPOS_TRANSPORTE = [
  "vehiculo_cliente",
  "delivery_subcontratado",
  "repartidor_propio",
] as const;

export type TipoTransporte = (typeof TIPOS_TRANSPORTE)[number];

export const TIPO_TRANSPORTE_LABEL: Record<TipoTransporte, string> = {
  vehiculo_cliente: "Vehículo del cliente",
  delivery_subcontratado: "Delivery subcontratado",
  repartidor_propio: "Repartidor propio",
};

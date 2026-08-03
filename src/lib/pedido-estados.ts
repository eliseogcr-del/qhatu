export const ESTADOS_PEDIDO = [
  "pendiente_confirmacion",
  "en_produccion",
  "listo_para_reparto",
  "en_reparto",
  "entregado",
  "cerrado",
  "cancelado",
] as const;

export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export const ESTADO_LABEL: Record<EstadoPedido, string> = {
  pendiente_confirmacion: "Pendiente de confirmación",
  en_produccion: "En producción",
  listo_para_reparto: "Listo para reparto",
  en_reparto: "En reparto",
  entregado: "Entregado",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

export const ESTADO_BADGE: Record<EstadoPedido, string> = {
  pendiente_confirmacion: "bg-yellow-100 text-yellow-700",
  en_produccion: "bg-blue-100 text-blue-700",
  listo_para_reparto: "bg-indigo-100 text-indigo-700",
  en_reparto: "bg-purple-100 text-purple-700",
  entregado: "bg-green-100 text-green-700",
  cerrado: "bg-gray-200 text-gray-700",
  cancelado: "bg-red-100 text-red-700",
};

const CANAL_LABEL: Record<string, string> = {
  telefono: "Teléfono",
  whatsapp_texto: "WhatsApp (texto)",
  whatsapp_imagen: "WhatsApp (imagen)",
  directo: "Venta directa",
  otro: "Otro",
};

export function canalLabel(canal: string) {
  return CANAL_LABEL[canal] ?? canal;
}

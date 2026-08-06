// Motivos para cuando, al editar una venta, la cantidad entregada de una
// línea baja por debajo de lo que decía el pedido original. A diferencia
// de una devolución (TIPOS_DEVOLUCION en devolucion-tipos.ts), el
// producto sigue en buen estado y vuelve a stock para venderse de nuevo
// — nunca se trata como merma.
export const TIPOS_AJUSTE_VENTA = [
  "cliente_no_llevo",
  "cambio_producto",
  "error_al_repartir",
  "otro",
] as const;

export type TipoAjusteVenta = (typeof TIPOS_AJUSTE_VENTA)[number];

export const TIPO_AJUSTE_VENTA_LABEL: Record<TipoAjusteVenta, string> = {
  cliente_no_llevo: "El cliente no se llevó el producto",
  cambio_producto: "El cliente cambió de producto",
  error_al_repartir: "Error al repartir",
  otro: "Otro",
};

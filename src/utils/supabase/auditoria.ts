import { createClient } from "./server";

export const TIPO_AUDITORIA = {
  ventaAgregarProducto: "venta_agregar_producto",
  ventaQuitarProducto: "venta_quitar_producto",
  ventaModificarProducto: "venta_modificar_producto",
  ventaAnular: "venta_anular",
  cobranzaAnular: "cobranza_anular",
  produccionAgregarProducto: "produccion_agregar_producto",
  produccionQuitarProducto: "produccion_quitar_producto",
  produccionModificarProducto: "produccion_modificar_producto",
} as const;

export type TipoAuditoria = (typeof TIPO_AUDITORIA)[keyof typeof TIPO_AUDITORIA];

// Registro inmutable de quién hizo qué sobre una venta o cobranza, cuándo,
// y con qué detalle — nunca se actualiza ni se borra una vez insertado.
export async function registrarAuditoria(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    empresaId: string;
    usuarioId: string;
    entidad: "venta" | "cobranza" | "produccion";
    entidadId: string;
    tipoMovimiento: TipoAuditoria;
    productoId?: string | null;
    productoNombre?: string | null;
    cantidad?: number | null;
    precioUnitario?: number | null;
    monto?: number | null;
    detalle?: string | null;
  },
) {
  await supabase.from("auditoria").insert({
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
    entidad: params.entidad,
    entidad_id: params.entidadId,
    tipo_movimiento: params.tipoMovimiento,
    producto_id: params.productoId ?? null,
    producto_nombre: params.productoNombre ?? null,
    cantidad: params.cantidad ?? null,
    precio_unitario: params.precioUnitario ?? null,
    monto: params.monto ?? null,
    detalle: params.detalle ?? null,
  });
}

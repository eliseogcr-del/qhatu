export const ROLES = [
  "admin",
  "vendedor",
  "logistica",
  "repartidor",
  "produccion",
  "contador",
] as const;

export type Rol = (typeof ROLES)[number];

export const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  logistica: "Logística",
  repartidor: "Repartidor",
  produccion: "Producción",
  contador: "Contador",
};

// Vendedor y producción quedan amarrados a un almacén fijo — admin y
// logística operan/ven a través de todos, y repartidor no se organiza por
// almacén sino por los repartos que tiene asignados.
export function requiereAlmacen(rol: string): boolean {
  return rol === "vendedor" || rol === "produccion";
}

// Admin y logística ven/operan en todos los almacenes (no tienen uno fijo),
// pero igual necesitan un "almacén de origen" por defecto para pantallas sin
// selector propio (ej. Venta rápida) — sin esto, si alguna vez quedó un
// almacen_id suelto en su usuario (de un rol anterior, por ejemplo) esa
// pantalla lo usaría a ciegas sin que nadie lo note. Por defecto es el
// almacén principal, pero es editable — a diferencia de requiereAlmacen,
// que amarra de verdad y no se puede cambiar por formulario.
export function puedeTenerAlmacenOrigen(rol: string): boolean {
  return rol === "admin" || rol === "logistica";
}

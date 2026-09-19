export const ROLES = ["admin", "vendedor", "logistica", "repartidor", "produccion"] as const;

export type Rol = (typeof ROLES)[number];

export const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  vendedor: "Vendedor",
  logistica: "Logística",
  repartidor: "Repartidor",
  produccion: "Producción",
};

// Vendedor y producción quedan amarrados a un almacén fijo — admin y
// logística operan/ven a través de todos, y repartidor no se organiza por
// almacén sino por los repartos que tiene asignados.
export function requiereAlmacen(rol: string): boolean {
  return rol === "vendedor" || rol === "produccion";
}

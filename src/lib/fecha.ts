// `toLocaleString`/`toLocaleDateString` sin `timeZone` usan la zona horaria
// del entorno donde corre el código — en producción eso es el servidor de
// Vercel (UTC), no la del usuario en Perú. Sin esto, cada fecha mostrada en
// la app aparecía ~5 horas adelantada. `"es-PE"` solo define el formato
// (orden día/mes/año, etc.), nunca la zona horaria — hay que fijarla aparte.
const ZONA_HORARIA = "America/Lima";

export function formatFecha(fecha: string | Date): string {
  return new Date(fecha).toLocaleDateString("es-PE", { timeZone: ZONA_HORARIA });
}

export function formatFechaHora(fecha: string | Date): string {
  return new Date(fecha).toLocaleString("es-PE", { timeZone: ZONA_HORARIA });
}

// Fecha de hoy en Perú como "AAAA-MM-DD", para prellenar filtros de fecha
// (un `new Date().toISOString()` sin esto daría la fecha UTC, que en la
// noche peruana ya es el día siguiente).
export function hoyLima(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA_HORARIA });
}

// Perú no tiene horario de verano, así que su offset es siempre fijo.
const OFFSET_LIMA = "-05:00";

// Los filtros de fecha (<input type="date">) entregan un día calendario
// "ingenuo", sin hora ni zona horaria. Al compararlo contra una columna
// timestamptz sin anclarlo a Lima explícitamente, Postgres usa la zona de
// sesión (UTC) — un registro de la noche peruana (después de las 7pm) cae
// en el día calendario UTC siguiente y desaparece de un filtro "hoy" o de
// un rango que debería incluirlo. Estas dos funciones fijan el límite
// inferior/superior del día calendario de Lima en UTC explícito para que
// la comparación sea correcta sin importar la zona de la sesión de la BD.
export function inicioDiaLima(fecha: string): string {
  return `${fecha}T00:00:00${OFFSET_LIMA}`;
}

export function finDiaLima(fecha: string): string {
  return `${fecha}T23:59:59.999${OFFSET_LIMA}`;
}

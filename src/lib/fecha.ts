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

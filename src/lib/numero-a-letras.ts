// Convierte un monto a su representación en letras para el "IMPORTE EN
// LETRAS" de la Nota de Venta (mismo formato que usan las boletas/facturas
// peruanas: "TRESCIENTOS OCHENTA CON 00/100 SOLES"). Cubre hasta 999
// millones, más que suficiente para un monto de venta.

const UNIDADES = [
  "", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE",
];
const DIECIS = [
  "DIEZ", "ONCE", "DOCE", "TRECE", "CATORCE", "QUINCE",
  "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE",
];
const DECENAS = [
  "", "", "VEINTE", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA",
];
const CENTENAS = [
  "", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS",
  "SEISCIENTOS", "SETECIENTOS", "OCHOCIENTOS", "NOVECIENTOS",
];

function seccionDecenas(n: number): string {
  if (n < 10) return UNIDADES[n];
  if (n < 20) return DIECIS[n - 10];
  const decena = Math.floor(n / 10);
  const unidad = n % 10;
  if (decena === 2) return unidad === 0 ? "VEINTE" : `VEINTI${UNIDADES[unidad]}`;
  if (unidad === 0) return DECENAS[decena];
  return `${DECENAS[decena]} Y ${UNIDADES[unidad]}`;
}

function seccionCentenas(n: number): string {
  if (n === 100) return "CIEN";
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const partes: string[] = [];
  if (centena > 0) partes.push(CENTENAS[centena]);
  if (resto > 0) partes.push(seccionDecenas(resto));
  return partes.join(" ");
}

function seccionMiles(n: number): string {
  const miles = Math.floor(n / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (miles > 0) partes.push(miles === 1 ? "MIL" : `${seccionCentenas(miles)} MIL`);
  if (resto > 0) partes.push(seccionCentenas(resto));
  return partes.join(" ");
}

function seccionMillones(n: number): string {
  const millones = Math.floor(n / 1_000_000);
  const resto = n % 1_000_000;
  const partes: string[] = [];
  if (millones > 0) {
    partes.push(millones === 1 ? "UN MILLON" : `${seccionMiles(millones)} MILLONES`);
  }
  if (resto > 0) partes.push(seccionMiles(resto));
  return partes.join(" ") || "CERO";
}

export function numeroALetras(monto: number, moneda: "PEN" | "USD" = "PEN"): string {
  const entero = Math.floor(Math.abs(monto));
  const centavos = Math.round((Math.abs(monto) - entero) * 100);
  const letras = entero === 0 ? "CERO" : seccionMillones(entero);
  const nombreMoneda = moneda === "USD" ? "DOLARES" : "SOLES";
  return `${letras} CON ${String(centavos).padStart(2, "0")}/100 ${nombreMoneda}`;
}

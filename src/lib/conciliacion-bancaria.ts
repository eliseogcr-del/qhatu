import type ExcelJS from "exceljs";

// Los reportes que bajan del app del banco/Yape/Plin traen el título y
// encabezados en filas variables (no siempre la 1), y cada celda llega
// como texto (a veces como rich text, nunca como número/fecha real de
// Excel) — nada de esto se puede asumir fijo de un archivo a otro, así
// que todo acá busca por contenido en vez de por posición exacta.

export type MovimientoArchivo = {
  monto: number;
  fecha: string; // "AAAA-MM-DD", para agrupar por día
  fechaHora: number; // epoch ms, para ordenar dentro del mismo monto/día
  destino: string | null;
  origen: string | null;
};

function textoDeCelda(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor.trim();
  if (typeof valor === "number") return String(valor);
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object" && "richText" in valor) {
    return (valor.richText as { text: string }[]).map((r) => r.text).join("").trim();
  }
  if (typeof valor === "object" && "text" in valor) {
    return String((valor as { text: unknown }).text).trim();
  }
  return String(valor).trim();
}

// "70.00", "S/ 70.00", "1,234.56", "70,00" (coma como decimal) — todas
// las variantes que un export bancario puede traer para un monto.
export function parsearMonto(texto: string): number | null {
  const limpio = texto.replace(/[^0-9.,-]/g, "");
  if (!limpio) return null;
  let normalizado = limpio;
  if (limpio.includes(",") && limpio.includes(".")) {
    normalizado = limpio.replace(/,/g, "");
  } else if (limpio.includes(",")) {
    normalizado = limpio.replace(",", ".");
  }
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}

// "24/11/2026 13:10:49" (día/mes/año, como exportan los apps peruanos) —
// nunca mes/día como en EE.UU., y los segundos son opcionales.
export function parsearFechaHora(texto: string): { fecha: string; fechaHora: number } | null {
  const match = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const [, d, m, a, h, mi, s] = match;
  const dia = d.padStart(2, "0");
  const mes = m.padStart(2, "0");
  const fecha = `${a}-${mes}-${dia}`;
  const fechaHora = Date.UTC(Number(a), Number(m) - 1, Number(d), Number(h), Number(mi), Number(s ?? 0));
  return { fecha, fechaHora };
}

// Busca la fila de encabezados DENTRO de las primeras filas (título,
// líneas en blanco, etc. antes de ella) por contenido, no por posición —
// la que tenga una celda con "monto" y otra con "fecha" es la cabecera.
function encontrarCabecera(sheet: ExcelJS.Worksheet): { fila: number; columnas: Map<string, number> } | null {
  const limiteFilas = Math.min(sheet.rowCount, 50);
  for (let f = 1; f <= limiteFilas; f++) {
    const row = sheet.getRow(f);
    const textos = new Map<number, string>();
    for (let c = 1; c <= sheet.columnCount; c++) {
      const texto = textoDeCelda(row.getCell(c).value).toLowerCase();
      if (texto) textos.set(c, texto);
    }
    const colMonto = [...textos.entries()].find(([, t]) => t.includes("monto"));
    const colFecha = [...textos.entries()].find(([, t]) => t.includes("fecha"));
    if (colMonto && colFecha) {
      const columnas = new Map<string, number>([
        ["monto", colMonto[0]],
        ["fecha", colFecha[0]],
      ]);
      const colDestino = [...textos.entries()].find(([, t]) => t.includes("destino"));
      const colOrigen = [...textos.entries()].find(([, t]) => t.includes("origen"));
      if (colDestino) columnas.set("destino", colDestino[0]);
      if (colOrigen) columnas.set("origen", colOrigen[0]);
      return { fila: f, columnas };
    }
  }
  return null;
}

export function extraerMovimientos(sheet: ExcelJS.Worksheet): {
  movimientos: MovimientoArchivo[];
  filasOmitidas: number;
} {
  const cabecera = encontrarCabecera(sheet);
  if (!cabecera) return { movimientos: [], filasOmitidas: 0 };

  const { fila: filaCabecera, columnas } = cabecera;
  const colMonto = columnas.get("monto")!;
  const colFecha = columnas.get("fecha")!;
  const colDestino = columnas.get("destino");
  const colOrigen = columnas.get("origen");

  const movimientos: MovimientoArchivo[] = [];
  let filasOmitidas = 0;

  for (let f = filaCabecera + 1; f <= sheet.rowCount; f++) {
    const row = sheet.getRow(f);
    const textoMonto = textoDeCelda(row.getCell(colMonto).value);
    const textoFecha = textoDeCelda(row.getCell(colFecha).value);
    if (!textoMonto && !textoFecha) continue; // fila en blanco, no corta el barrido por si hay huecos

    const monto = parsearMonto(textoMonto);
    const fechaHora = parsearFechaHora(textoFecha);
    if (monto === null || !fechaHora) {
      filasOmitidas += 1;
      continue;
    }

    movimientos.push({
      monto,
      fecha: fechaHora.fecha,
      fechaHora: fechaHora.fechaHora,
      destino: colDestino ? textoDeCelda(row.getCell(colDestino).value) || null : null,
      origen: colOrigen ? textoDeCelda(row.getCell(colOrigen).value) || null : null,
    });
  }

  return { movimientos, filasOmitidas };
}

export type CobroSistema = {
  id: string;
  monto: number;
  fechaHora: number;
  metodoPago: string;
  clienteNombre: string;
  usuarioNombre: string;
  referencia: string | null;
};

export type ResultadoCruce = {
  encontrados: { cobro: CobroSistema; movimiento: MovimientoArchivo }[];
  soloEnSistema: CobroSistema[];
  soloEnArchivo: MovimientoArchivo[];
};

// Empareja 1 a 1 EN ORDEN cronológico dentro de cada monto exacto (ej. si
// hay tres cobros de S/36.00 ese día y tres movimientos de S/36.00 en el
// archivo, el más antiguo de cada lado se empareja con el más antiguo del
// otro lado, y así sucesivamente) — nunca por nombre, que no calza entre
// el archivo del banco y la base de datos.
export function cruzarMovimientos(
  cobrosSistema: CobroSistema[],
  movimientosArchivo: MovimientoArchivo[],
): ResultadoCruce {
  const porMontoSistema = new Map<string, CobroSistema[]>();
  for (const c of cobrosSistema) {
    const clave = c.monto.toFixed(2);
    porMontoSistema.set(clave, [...(porMontoSistema.get(clave) ?? []), c]);
  }
  const porMontoArchivo = new Map<string, MovimientoArchivo[]>();
  for (const m of movimientosArchivo) {
    const clave = m.monto.toFixed(2);
    porMontoArchivo.set(clave, [...(porMontoArchivo.get(clave) ?? []), m]);
  }
  for (const lista of porMontoSistema.values()) lista.sort((a, b) => a.fechaHora - b.fechaHora);
  for (const lista of porMontoArchivo.values()) lista.sort((a, b) => a.fechaHora - b.fechaHora);

  const encontrados: ResultadoCruce["encontrados"] = [];
  const soloEnSistema: CobroSistema[] = [];
  const soloEnArchivo: MovimientoArchivo[] = [];

  const montos = new Set([...porMontoSistema.keys(), ...porMontoArchivo.keys()]);
  for (const clave of montos) {
    const cobros = porMontoSistema.get(clave) ?? [];
    const movimientos = porMontoArchivo.get(clave) ?? [];
    const pares = Math.min(cobros.length, movimientos.length);
    for (let i = 0; i < pares; i++) {
      encontrados.push({ cobro: cobros[i], movimiento: movimientos[i] });
    }
    soloEnSistema.push(...cobros.slice(pares));
    soloEnArchivo.push(...movimientos.slice(pares));
  }

  return { encontrados, soloEnSistema, soloEnArchivo };
}

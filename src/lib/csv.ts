function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// BOM so Excel reads accents correctly, and a "sep=," directive so Excel
// splits into columns even on regional settings (e.g. Spanish/Peru) where
// the comma is the decimal separator and Excel defaults CSVs to ";".
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ];
  return "﻿sep=,\r\n" + lines.join("\r\n");
}

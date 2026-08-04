function cellEscape(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return /["\t\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildText(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.join("\t"),
    ...rows.map((row) => row.map(cellEscape).join("\t")),
  ];
  return lines.join("\r\n");
}

// Tab-delimited UTF-16LE with a BOM — the exact format Excel itself writes
// for "Unicode Text (*.txt)". Plain UTF-8 CSV is unreliable when
// double-clicked in older Excel versions or under Spanish/Peru regional
// settings (comma is the decimal separator there, so Excel expects ';' and
// misreads UTF-8 accents), while this combination opens correctly across
// Excel versions and locales without any configuration.
export function buildExcelText(headers: string[], rows: unknown[][]): ArrayBuffer {
  const text = buildText(headers, rows);
  const buffer = new ArrayBuffer(2 + text.length * 2);
  const view = new DataView(buffer);
  view.setUint16(0, 0xfeff, true);
  for (let i = 0; i < text.length; i++) {
    view.setUint16(2 + i * 2, text.charCodeAt(i), true);
  }
  return buffer;
}

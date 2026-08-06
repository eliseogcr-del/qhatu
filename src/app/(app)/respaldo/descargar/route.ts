import JSZip from "jszip";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import { buildExcelText } from "@/lib/csv";

// Todas las tablas de negocio. RLS ya limita cada consulta a la empresa
// del admin que la pide, así que no hace falta filtrar por empresa_id acá.
const TABLAS = [
  "clientes",
  "productos",
  "proveedores",
  "pedidos",
  "pedido_detalle",
  "ventas",
  "venta_detalle",
  "devoluciones",
  "cobranzas",
  "cobranza_adjuntos",
  "compras",
  "compra_detalle",
  "pagos_proveedor",
  "almacenes",
  "inventario",
  "kardex_movimientos",
  "usuarios",
  "auditoria",
] as const;

export async function GET() {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const zip = new JSZip();

  for (const tabla of TABLAS) {
    const { data } = await supabase.from(tabla).select("*");
    if (!data || data.length === 0) continue;

    const headers = Object.keys(data[0] as Record<string, unknown>);
    const rows = data.map((fila) =>
      headers.map((h) => (fila as Record<string, unknown>)[h]),
    );
    zip.file(`${tabla}.csv`, buildExcelText(headers, rows));
  }

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  const zipBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength,
  ) as ArrayBuffer;

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="respaldo-qhatu-${fecha}.zip"`,
    },
  });
}

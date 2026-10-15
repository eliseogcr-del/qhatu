import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import { formatFecha } from "@/lib/fecha";
import { buildExcelText } from "@/lib/csv";
import { obtenerFilasAuditoriaIgv } from "../shared";

const HEADERS = [
  "Fecha",
  "Documento",
  "Cliente",
  "Total",
  "Gravada declarada",
  "IGV declarado",
  "Gravada correcta",
  "IGV correcto",
  "Diferencia IGV",
];

export async function GET() {
  const supabase = await createClient();
  const { empresaId } = await requireComprobantesAcceso(supabase);

  const { filas } = await obtenerFilasAuditoriaIgv(supabase, empresaId);

  const rows = filas.map((f) => [
    formatFecha(f.fecha),
    f.documento,
    f.clienteNombre,
    f.total.toFixed(2),
    f.gravadaDeclarada.toFixed(2),
    f.igvDeclarado.toFixed(2),
    f.gravadaCorrecta.toFixed(2),
    f.igvCorrecto.toFixed(2),
    f.diferenciaIgv.toFixed(2),
  ]);

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="auditoria-igv.csv"',
    },
  });
}

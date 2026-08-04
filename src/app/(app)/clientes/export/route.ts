import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildExcelText } from "@/lib/csv";

const COLUMNS = [
  "tipo_documento",
  "numero_documento",
  "nombre",
  "contacto",
  "correo_electronico",
  "telefono",
  "departamento",
  "provincia",
  "distrito",
  "direccion",
  "zona",
  "giro_negocio",
  "grupo",
  "linea_credito",
  "codigo_interno",
  "activo",
] as const;

const HEADERS = [
  "Tipo doc.",
  "N° documento",
  "Nombre / Razón social",
  "Contacto",
  "Correo",
  "Teléfono",
  "Departamento",
  "Provincia",
  "Distrito",
  "Dirección",
  "Zona",
  "Giro de negocio",
  "Grupo",
  "Línea de crédito",
  "Código interno",
  "Activo",
];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q");

  let query = supabase
    .from("clientes")
    .select(
      "tipo_documento, numero_documento, nombre, contacto, correo_electronico, telefono, departamento, provincia, distrito, direccion, zona, giro_negocio, grupo, linea_credito, codigo_interno, activo",
    )
    .order("nombre");
  if (q) query = query.ilike("nombre", `%${q}%`);

  const { data: clientes } = await query;

  const rows = (clientes ?? []).map((c) =>
    COLUMNS.map((col) => (c as Record<string, unknown>)[col]),
  );

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="clientes.csv"',
    },
  });
}

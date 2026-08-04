import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildExcelText } from "@/lib/csv";

const COLUMNS = [
  "nombre",
  "ruc",
  "contacto",
  "telefono",
  "correo_electronico",
  "activo",
] as const;

const HEADERS = [
  "Nombre",
  "RUC",
  "Contacto",
  "Teléfono",
  "Correo",
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
    .from("proveedores")
    .select("nombre, ruc, contacto, telefono, correo_electronico, activo")
    .order("nombre");
  if (q) query = query.ilike("nombre", `%${q}%`);

  const { data: proveedores } = await query;

  const rows = (proveedores ?? []).map((p) =>
    COLUMNS.map((col) => (p as Record<string, unknown>)[col]),
  );

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="proveedores.csv"',
    },
  });
}

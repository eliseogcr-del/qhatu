import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

function csvEscape(value: unknown) {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

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
    COLUMNS.map((col) => csvEscape((c as Record<string, unknown>)[col])).join(","),
  );

  const csv = "﻿" + [HEADERS.join(","), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="clientes.csv"',
    },
  });
}

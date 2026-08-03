import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

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
    .from("proveedores")
    .select("nombre, ruc, contacto, telefono, correo_electronico, activo")
    .order("nombre");
  if (q) query = query.ilike("nombre", `%${q}%`);

  const { data: proveedores } = await query;

  const rows = (proveedores ?? []).map((p) =>
    COLUMNS.map((col) => csvEscape((p as Record<string, unknown>)[col])).join(","),
  );

  const csv = "﻿" + [HEADERS.join(","), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="proveedores.csv"',
    },
  });
}

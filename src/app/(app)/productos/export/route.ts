import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildCsv } from "@/lib/csv";

const COLUMNS = [
  "codigo_barra",
  "codigo_proveedor",
  "nombre",
  "marca",
  "grupo",
  "familia",
  "modelo",
  "tipo_producto",
  "precio_venta",
  "precio_venta_moneda",
  "costo_referencial",
  "control_inventario",
  "stock_minimo",
  "activo",
] as const;

const HEADERS = [
  "Código de barra",
  "Código de proveedor",
  "Nombre",
  "Marca",
  "Grupo",
  "Familia",
  "Modelo",
  "Tipo de producto",
  "Precio de venta",
  "Moneda",
  "Costo referencial",
  "Control de inventario",
  "Stock mínimo",
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
    .from("productos")
    .select(
      "codigo_barra, codigo_proveedor, nombre, marca, grupo, familia, modelo, tipo_producto, precio_venta, precio_venta_moneda, costo_referencial, control_inventario, stock_minimo, activo",
    )
    .order("nombre");
  if (q) query = query.ilike("nombre", `%${q}%`);

  const { data: productos } = await query;

  const rows = (productos ?? []).map((p) =>
    COLUMNS.map((col) => (p as Record<string, unknown>)[col]),
  );

  const csv = buildCsv(HEADERS, rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="productos.csv"',
    },
  });
}

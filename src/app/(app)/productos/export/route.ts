import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { buildExcelText } from "@/lib/csv";

const COLUMNS = [
  "codigo_barra",
  "codigo_proveedor",
  "nombre",
  "marca",
  "grupo",
  "familia",
  "modelo",
  "tipo_producto",
  "precio_campo",
  "precio_digital",
  "precio_venta_moneda",
  "costo_referencial",
  "control_inventario",
  "stock_minimo",
  "stock_maximo",
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
  "Precio Campo",
  "Precio Digital",
  "Moneda",
  "Costo referencial",
  "Control de inventario",
  "Stock mínimo",
  "Stock máximo",
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
      "codigo_barra, codigo_proveedor, nombre, marca, grupo, familia, modelo, tipo_producto, precio_campo, precio_digital, precio_venta_moneda, costo_referencial, control_inventario, stock_minimo, stock_maximo, activo",
    )
    .order("nombre");
  if (q) query = query.ilike("nombre", `%${q}%`);

  const { data: productos } = await query;

  const rows = (productos ?? []).map((p) =>
    COLUMNS.map((col) => (p as Record<string, unknown>)[col]),
  );

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="productos.csv"',
    },
  });
}

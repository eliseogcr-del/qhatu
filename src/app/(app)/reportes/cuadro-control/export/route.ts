import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchCuadroControlProductos } from "@/utils/supabase/cuadro-control";
import { buildExcelText } from "@/lib/csv";

const HEADERS = [
  "Almacén",
  "Producto",
  "Unidad de medida",
  "Saldo anterior",
  "Trasladada",
  "Vendida",
  "Abastecida",
  "Merma",
  "Stock Actual (Diferencia)",
];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const params = request.nextUrl.searchParams;

  const { filas } = await fetchCuadroControlProductos(supabase, {
    fechaDesde: params.get("desde"),
    fechaHasta: params.get("hasta"),
    almacenId: params.get("almacen_id"),
  });

  const rows = filas.map((f) => [
    f.almacenNombre,
    f.productoNombre,
    f.unidadMedida,
    f.saldoAnterior,
    f.trasladada,
    f.vendida,
    f.abastecida,
    f.merma,
    f.diferencia,
  ]);

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="cuadro-control-productos.csv"',
    },
  });
}

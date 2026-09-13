import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchCuadroControlProductos, COLUMNA_LABEL } from "@/utils/supabase/cuadro-control";
import { buildExcelText } from "@/lib/csv";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const params = request.nextUrl.searchParams;

  const { filas, columnas } = await fetchCuadroControlProductos(supabase, {
    fechaDesde: params.get("desde"),
    fechaHasta: params.get("hasta"),
    almacenId: params.get("almacen_id"),
  });

  const headers = [
    "Almacén",
    "Producto",
    "Unidad de medida",
    ...columnas.map((c) => COLUMNA_LABEL[c]),
    "Stock actual",
  ];

  const rows = filas.map((f) => [
    f.almacenNombre,
    f.productoNombre,
    f.unidadMedida,
    ...columnas.map((c) => f.cantidadesPorColumna[c] ?? 0),
    f.stockActual,
  ]);

  const body = buildExcelText(headers, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="cuadro-control-productos.csv"',
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { formatFecha } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { fetchDetalleProductosVendidos } from "@/utils/supabase/ventas";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import { buildExcelText } from "@/lib/csv";

const HEADERS = [
  "Cliente",
  "Tipo de documento",
  "N° de documento",
  "Fecha",
  "Producto",
  "Unidad de medida",
  "Cantidad",
  "Precio unitario",
  "Importe total",
  "Almacén",
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

  const { filas } = await fetchDetalleProductosVendidos(supabase, {
    clienteNombre: params.get("q"),
    productoId: params.get("producto_id"),
    fechaDesde: params.get("desde"),
    fechaHasta: params.get("hasta"),
    almacenId: params.get("almacen_id"),
  });

  const rows = filas.map((f) => [
    f.clienteNombre ?? "—",
    f.comprobanteTipo != null ? (TIPO_COMPROBANTE_LABEL[f.comprobanteTipo] ?? "—") : "—",
    f.comprobanteNumero ?? "—",
    formatFecha(f.fecha),
    f.productoNombre,
    f.unidadMedida ?? "—",
    f.cantidad,
    f.precioUnitario,
    f.importe,
    f.almacenNombre ?? "—",
  ]);

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="productos-vendidos.csv"',
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { fetchVentasConSaldo } from "@/utils/supabase/ventas";
import { buildExcelText } from "@/lib/csv";

const HEADERS = [
  "Cliente",
  "Fecha",
  "Moneda",
  "Total",
  "Cobrado",
  "Saldo pendiente",
  "Estado",
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

  const { ventas } = await fetchVentasConSaldo(supabase, {
    clienteNombre: params.get("q"),
    fechaDesde: params.get("desde"),
    fechaHasta: params.get("hasta"),
    soloPendientes: params.get("pendientes") === "1",
  });

  const rows = ventas.map((v) => [
    v.cliente_nombre,
    new Date(v.fecha).toLocaleDateString("es-PE"),
    v.moneda,
    v.total,
    v.cobrado,
    v.saldo,
    v.estado,
  ]);

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="ventas.csv"',
    },
  });
}

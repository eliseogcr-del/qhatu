import { NextResponse, type NextRequest } from "next/server";
import { formatFecha } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { fetchComprasConSaldo } from "@/utils/supabase/compras";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";
import { buildExcelText } from "@/lib/csv";

const HEADERS = [
  "Código compra",
  "Proveedor",
  "Fecha compra",
  "Total compra",
  "Fecha de pago",
  "Monto pagado",
  "Método de pago",
  "Registrado por",
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

  const { compras } = await fetchComprasConSaldo(supabase, {
    proveedorNombre: params.get("q"),
    fechaDesde: params.get("desde"),
    fechaHasta: params.get("hasta"),
    soloPendientes: params.get("pendientes") === "1",
  });

  const rows = compras.flatMap((c) =>
    c.pagos.map((p) => [
      c.id.slice(0, 8).toUpperCase(),
      c.proveedor_nombre,
      formatFecha(c.fecha),
      c.total,
      formatFecha(p.fecha),
      p.monto,
      METODO_PAGO_LABEL[p.metodoPago as MetodoPago] ?? p.metodoPago,
      p.usuarioNombre ?? "",
    ]),
  );

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="compras-detalle-pagos.csv"',
    },
  });
}

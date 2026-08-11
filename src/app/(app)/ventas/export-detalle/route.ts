import { NextResponse, type NextRequest } from "next/server";
import { formatFecha } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { fetchVentasConSaldo } from "@/utils/supabase/ventas";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";
import { buildExcelText } from "@/lib/csv";

const HEADERS = [
  "Código venta",
  "Cliente",
  "Fecha venta",
  "Total venta",
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

  const { ventas } = await fetchVentasConSaldo(supabase, {
    clienteNombre: params.get("q"),
    fechaDesde: params.get("desde"),
    fechaHasta: params.get("hasta"),
    soloPendientes: params.get("pendientes") === "1",
    almacenId: params.get("almacen_id"),
    vendedorId: params.get("vendedor_id"),
  });

  const rows = ventas.flatMap((v) =>
    v.pagos.map((p) => [
      v.id.slice(0, 8).toUpperCase(),
      v.cliente_nombre,
      formatFecha(v.fecha),
      v.total,
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
      "Content-Disposition": 'attachment; filename="ventas-detalle-pagos.csv"',
    },
  });
}

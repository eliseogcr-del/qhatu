import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { formatFecha } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { fetchVentasConSaldo } from "@/utils/supabase/ventas";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";

const HEADERS_PAGOS = [
  "Código venta",
  "Cliente",
  "Fecha venta",
  "Total venta",
  "Fecha de pago",
  "Monto pagado",
  "Método de pago",
  "Registrado por",
];

const HEADERS_VENTAS = [
  "Tipo de documento",
  "N° de documento",
  "Cliente",
  "Local",
  "Vendedor",
  "Fecha",
  "Total",
  "Descuento",
  "Pagado",
  "Saldo pendiente",
  "Estado",
];

function agregarHoja(workbook: ExcelJS.Workbook, nombre: string, headers: string[], rows: unknown[][]) {
  const sheet = workbook.addWorksheet(nombre);
  sheet.addRow(headers).font = { bold: true };
  for (const row of rows) sheet.addRow(row);
  sheet.columns.forEach((col) => {
    col.width = 18;
  });
}

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

  const filasPagos = ventas.flatMap((v) =>
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

  const filasVentas = ventas.map((v) => [
    v.comprobante_tipo != null ? (TIPO_COMPROBANTE_LABEL[v.comprobante_tipo] ?? "—") : "—",
    v.comprobante_numero ?? "—",
    v.cliente_nombre,
    v.almacen_nombre,
    v.vendedor_nombre,
    formatFecha(v.fecha),
    v.total,
    v.descuento,
    v.cobrado,
    v.saldo,
    v.estado,
  ]);

  const workbook = new ExcelJS.Workbook();
  agregarHoja(workbook, "Detalle de pagos", HEADERS_PAGOS, filasPagos);
  agregarHoja(workbook, "Ventas", HEADERS_VENTAS, filasVentas);

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ventas-detalle.xlsx"',
    },
  });
}

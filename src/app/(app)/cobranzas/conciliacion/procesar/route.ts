import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/utils/supabase/server";
import { inicioDiaLima, finDiaLima, formatFechaHora } from "@/lib/fecha";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";
import {
  extraerMovimientos,
  cruzarMovimientos,
  type CobroSistema,
} from "@/lib/conciliacion-bancaria";

// Solo estos tres métodos son "pagos digitales" conciliables contra un
// reporte de banco/Yape/Plin — efectivo nunca aparece en ese archivo.
const METODOS_CONCILIABLES: MetodoPago[] = ["yape", "plin", "transferencia"];

const HEADERS = [
  "Resultado",
  "Fecha",
  "Monto",
  "Método de pago (sistema)",
  "Cliente (sistema)",
  "Vendedor (sistema)",
  "Referencia (sistema)",
  "Fecha/hora (archivo)",
  "Monto (archivo)",
  "Destino (archivo)",
  "Origen (archivo)",
];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El proxy ya bloquea llegar hasta acá sin la opción "/cobranzas/
  // conciliacion" (o ser admin) — igual que el resto de rutas de export
  // de este módulo, acá solo se valida que haya sesión.
  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const formData = await request.formData();
  const fecha = String(formData.get("fecha") || "");
  const archivos = formData.getAll("archivos").filter((f): f is File => f instanceof File && f.size > 0);

  if (!fecha) {
    return new NextResponse("Selecciona la fecha a conciliar.", { status: 400 });
  }
  if (archivos.length === 0) {
    return new NextResponse("Sube al menos un archivo.", { status: 400 });
  }

  const movimientos: ReturnType<typeof extraerMovimientos>["movimientos"] = [];
  let filasOmitidasTotal = 0;
  for (const archivo of archivos) {
    const buffer = await archivo.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      return new NextResponse(
        `"${archivo.name}" no se pudo leer como Excel — ¿lo guardaste tal cual lo descargaste?`,
        { status: 400 },
      );
    }
    for (const sheet of workbook.worksheets) {
      const { movimientos: delSheet, filasOmitidas } = extraerMovimientos(sheet);
      movimientos.push(...delSheet);
      filasOmitidasTotal += filasOmitidas;
    }
  }

  // Un movimiento de otro día (ej. el archivo trae un par de filas del
  // día anterior por el huso horario del banco) no entra al cruce — se
  // concilia exactamente la fecha elegida, no "lo que vino en el archivo".
  const movimientosDelDia = movimientos.filter((m) => m.fecha === fecha);

  const { data: cobranzasRaw } = await supabase
    .from("cobranzas")
    .select(
      "id, fecha, monto, metodo_pago, referencia, pedidos(clientes(nombre)), usuarios(nombre)",
    )
    .gte("fecha", inicioDiaLima(fecha))
    .lte("fecha", finDiaLima(fecha))
    .eq("estado", "activa")
    .in("metodo_pago", METODOS_CONCILIABLES);

  const cobrosSistema: CobroSistema[] = (cobranzasRaw ?? []).map((c) => {
    const pedido = c.pedidos as unknown as { clientes: { nombre: string } | null } | null;
    const usuario = c.usuarios as unknown as { nombre: string | null } | null;
    return {
      id: c.id,
      monto: c.monto,
      fechaHora: new Date(c.fecha).getTime(),
      metodoPago: c.metodo_pago,
      clienteNombre: pedido?.clientes?.nombre ?? "—",
      usuarioNombre: usuario?.nombre ?? "—",
      referencia: c.referencia,
    };
  });

  const resultado = cruzarMovimientos(cobrosSistema, movimientosDelDia);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Conciliación");
  sheet.addRow(HEADERS).font = { bold: true };
  sheet.columns = HEADERS.map((h) => ({ width: Math.max(16, h.length + 2) }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const { cobro, movimiento } of resultado.encontrados) {
    sheet.addRow([
      "Encontrado",
      fecha,
      cobro.monto,
      METODO_PAGO_LABEL[cobro.metodoPago as MetodoPago] ?? cobro.metodoPago,
      cobro.clienteNombre,
      cobro.usuarioNombre,
      cobro.referencia ?? "—",
      formatFechaHora(new Date(movimiento.fechaHora).toISOString()),
      movimiento.monto,
      movimiento.destino ?? "—",
      movimiento.origen ?? "—",
    ]);
  }
  for (const cobro of resultado.soloEnSistema) {
    sheet.addRow([
      "No encontrado en el archivo",
      fecha,
      cobro.monto,
      METODO_PAGO_LABEL[cobro.metodoPago as MetodoPago] ?? cobro.metodoPago,
      cobro.clienteNombre,
      cobro.usuarioNombre,
      cobro.referencia ?? "—",
      "—",
      null,
      "—",
      "—",
    ]);
  }
  for (const movimiento of resultado.soloEnArchivo) {
    sheet.addRow([
      "No encontrado en el sistema",
      fecha,
      null,
      "—",
      "—",
      "—",
      "—",
      formatFechaHora(new Date(movimiento.fechaHora).toISOString()),
      movimiento.monto,
      movimiento.destino ?? "—",
      movimiento.origen ?? "—",
    ]);
  }

  for (const col of [3, 9]) {
    sheet.getColumn(col).numFmt = "#,##0.00";
  }

  if (filasOmitidasTotal > 0) {
    sheet.addRow([]);
    sheet.addRow([
      `Nota: ${filasOmitidasTotal} fila(s) del archivo no se pudieron leer (monto o fecha con un formato inesperado) y no entraron al cruce.`,
    ]);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="conciliacion-${fecha}.xlsx"`,
    },
  });
}

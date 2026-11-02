import { NextResponse, type NextRequest } from "next/server";
import { formatFecha, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { METODO_PAGO_LABEL, TIPO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";
import { TIPO_COMPROBANTE_LABEL, TIPO_NOTA_VENTA } from "@/lib/comprobante-links";
import { buildExcelText } from "@/lib/csv";
import { chunk } from "@/lib/chunk";

const HEADERS = [
  "Cliente",
  "Tipo de documento",
  "N° de documento",
  "Importe de la venta",
  "Cobrado acumulado",
  "Saldo",
  "Fecha de pago",
  "Monto",
  "Moneda",
  "Método de pago",
  "Tipo",
  "Referencia",
  "Registrado por",
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
  const q = params.get("q");
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  const metodoPago = params.get("metodo_pago");
  const tipoPago = params.get("tipo_pago");
  const estado = params.get("estado");

  let query = supabase
    .from("cobranzas")
    .select(
      q
        ? "id, fecha, monto, moneda, metodo_pago, tipo_pago, referencia, estado, venta_id, pedidos!inner(clientes!inner(nombre)), usuarios(nombre)"
        : "id, fecha, monto, moneda, metodo_pago, tipo_pago, referencia, estado, venta_id, pedidos(clientes(nombre)), usuarios(nombre)",
    )
    .order("fecha", { ascending: false });

  if (q) query = query.ilike("pedidos.clientes.nombre", `%${q}%`);
  if (desde) query = query.gte("fecha", inicioDiaLima(desde));
  if (hasta) query = query.lte("fecha", finDiaLima(hasta));
  if (metodoPago) query = query.eq("metodo_pago", metodoPago);
  if (tipoPago) query = query.eq("tipo_pago", tipoPago);
  if (estado) query = query.eq("estado", estado);

  const { data: cobranzas } = await query;
  const filas = cobranzas ?? [];

  // Lo que se le pide a este export, a diferencia del listado en pantalla
  // (una fila por cobro): agrupar por VENTA — cada venta aparece una sola
  // vez con su documento, importe, cobrado acumulado y saldo, y debajo (si
  // hubo más de un pago) el detalle de cada cobro que calza con el filtro.
  // El cobrado acumulado/saldo de la venta son el dato REAL de esa venta
  // (todos sus cobros activos, sin importar el filtro de fecha) — no solo
  // la suma de los cobros que entraron al filtro, porque si no el saldo
  // mostrado no cuadraría con el que ve el resto del sistema.
  const ventaIds = [...new Set(filas.map((c) => c.venta_id).filter((id): id is string => Boolean(id)))];
  const idChunks = chunk(ventaIds, 150);

  const [ventasData, cobranzasActivasData, comprobantesData] = await Promise.all([
    idChunks.length > 0
      ? Promise.all(
          idChunks.map((ids) => supabase.from("ventas").select("id, total, descuento, estado").in("id", ids)),
        ).then((r) => r.flatMap((x) => x.data ?? []))
      : Promise.resolve([] as { id: string; total: number; descuento: number; estado: string }[]),
    idChunks.length > 0
      ? Promise.all(
          idChunks.map((ids) =>
            supabase.from("cobranzas").select("venta_id, monto").in("venta_id", ids).eq("estado", "activa"),
          ),
        ).then((r) => r.flatMap((x) => x.data ?? []))
      : Promise.resolve([] as { venta_id: string; monto: number }[]),
    idChunks.length > 0
      ? Promise.all(
          idChunks.map((ids) =>
            supabase
              .from("comprobantes")
              .select("venta_id, tipo_comprobante, serie, numero")
              .in("venta_id", ids)
              .eq("estado", "emitido"),
          ),
        ).then((r) => r.flatMap((x) => x.data ?? []))
      : Promise.resolve([] as { venta_id: string; tipo_comprobante: number; serie: string; numero: number }[]),
  ]);

  const ventaPorId = new Map(ventasData.map((v) => [v.id, v]));

  const cobradoPorVenta = new Map<string, number>();
  for (const c of cobranzasActivasData) {
    cobradoPorVenta.set(c.venta_id, (cobradoPorVenta.get(c.venta_id) ?? 0) + c.monto);
  }

  // Si hay varios comprobantes emitidos para la misma venta (ej. nota de
  // venta + boleta), la factura/boleta manda sobre la nota de venta — es
  // el documento "real" ante SUNAT (mismo criterio que fetchVentasConSaldo).
  const comprobantePorVenta = new Map<string, { tipo: number; serie: string; numero: number }>();
  for (const c of comprobantesData) {
    const actual = comprobantePorVenta.get(c.venta_id);
    if (!actual || (actual.tipo === TIPO_NOTA_VENTA && c.tipo_comprobante !== TIPO_NOTA_VENTA)) {
      comprobantePorVenta.set(c.venta_id, { tipo: c.tipo_comprobante, serie: c.serie, numero: c.numero });
    }
  }

  // Agrupa los cobros FILTRADOS por venta_id — los sin venta (anticipo de
  // un pedido que todavía no tiene venta) quedan cada uno en su propio
  // grupo, porque no hay venta de la cual traer documento/importe/saldo.
  type Cobro = (typeof filas)[number];
  const gruposPorVenta = new Map<string, Cobro[]>();
  const sueltos: Cobro[] = [];
  for (const c of filas) {
    if (!c.venta_id) {
      sueltos.push(c);
      continue;
    }
    const lista = gruposPorVenta.get(c.venta_id) ?? [];
    lista.push(c);
    gruposPorVenta.set(c.venta_id, lista);
  }

  type Grupo = { ventaId: string | null; cobros: Cobro[]; fechaOrden: string };
  const grupos: Grupo[] = [
    ...[...gruposPorVenta.entries()].map(([ventaId, cobros]) => ({
      ventaId,
      cobros,
      fechaOrden: cobros[0].fecha,
    })),
    ...sueltos.map((c) => ({ ventaId: null, cobros: [c], fechaOrden: c.fecha })),
  ];
  grupos.sort((a, b) => (a.fechaOrden < b.fechaOrden ? 1 : a.fechaOrden > b.fechaOrden ? -1 : 0));

  const rows: unknown[][] = [];
  for (const grupo of grupos) {
    const venta = grupo.ventaId ? ventaPorId.get(grupo.ventaId) : null;
    const comprobante = grupo.ventaId ? comprobantePorVenta.get(grupo.ventaId) : null;
    const cobradoAcumulado = grupo.ventaId ? (cobradoPorVenta.get(grupo.ventaId) ?? 0) : null;
    const importeVenta = venta ? Math.round((venta.total - venta.descuento) * 100) / 100 : null;
    const saldoVenta =
      venta && cobradoAcumulado !== null
        ? venta.estado === "anulada"
          ? 0
          : Math.round((venta.total - venta.descuento - cobradoAcumulado) * 100) / 100
        : null;

    grupo.cobros.forEach((c, i) => {
      const cliente = (c.pedidos as unknown as { clientes: { nombre: string } | null } | null)?.clientes;
      const usuario = c.usuarios as unknown as { nombre: string | null } | null;
      const esPrimeraDeLaVenta = i === 0;

      rows.push([
        esPrimeraDeLaVenta ? (cliente?.nombre ?? "—") : "",
        esPrimeraDeLaVenta
          ? grupo.ventaId
            ? comprobante
              ? TIPO_COMPROBANTE_LABEL[comprobante.tipo]
              : "Sin comprobante emitido"
            : "Sin venta asociada"
          : "",
        esPrimeraDeLaVenta ? (comprobante ? `${comprobante.serie}-${comprobante.numero}` : "—") : "",
        esPrimeraDeLaVenta ? importeVenta : "",
        esPrimeraDeLaVenta ? cobradoAcumulado : "",
        esPrimeraDeLaVenta ? saldoVenta : "",
        formatFecha(c.fecha),
        c.monto,
        c.moneda,
        METODO_PAGO_LABEL[c.metodo_pago as MetodoPago] ?? c.metodo_pago,
        TIPO_PAGO_LABEL[c.tipo_pago] ?? c.tipo_pago,
        c.referencia ?? "—",
        usuario?.nombre ?? "—",
        c.estado === "anulada" ? "Anulada" : "Activa",
      ]);
    });
  }

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="cobranzas.csv"',
    },
  });
}

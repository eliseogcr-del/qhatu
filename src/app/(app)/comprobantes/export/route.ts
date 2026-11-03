import { NextResponse, type NextRequest } from "next/server";
import ExcelJS from "exceljs";
import { formatFecha, hoyLima, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import { obtenerPorcentajeIgv } from "@/utils/supabase/comprobantes";

const HEADERS = [
  "Tipo de documento",
  "Serie-Número",
  "Cliente",
  "Almacén",
  "Fecha",
  "Moneda",
  "Base imponible",
  "IGV",
  "Total",
  "Estado",
];

// La Guía de Remisión vive en su propia tabla (ver comprobantes/page.tsx) —
// se consulta aparte y se normaliza a la misma forma de fila antes de
// mezclar y ordenar, igual que en el listado.
const TIPO_GUIA_REMISION = 7;

type Fila = {
  tipoComprobante: number;
  serie: string;
  numero: number;
  estado: string;
  fechaEmision: string;
  clienteNombre: string;
  almacenNombre: string;
  moneda: string;
  baseImponible: number | null;
  igv: number | null;
  total: number | null;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { empresaId } = await requireComprobantesAcceso(supabase, "/comprobantes");
  const porcentajeIgv = await obtenerPorcentajeIgv(supabase, empresaId);
  const factorIgv = porcentajeIgv / 100;

  const params = request.nextUrl.searchParams;
  const q = params.get("q");
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  const estado = params.get("estado");
  const tipo = params.get("tipo");

  const hoy = hoyLima();
  const desdeEfectivo = desde ?? hoy;
  const hastaEfectivo = hasta ?? hoy;

  const tipoNumero = tipo ? Number(tipo) : null;
  const incluirComprobantes = !tipoNumero || tipoNumero !== TIPO_GUIA_REMISION;
  const incluirGuiasRemision = !tipoNumero || tipoNumero === TIPO_GUIA_REMISION;

  let filasComprobantes: Fila[] = [];

  if (incluirComprobantes) {
    let query = supabase
      .from("comprobantes")
      .select(
        q
          ? "tipo_comprobante, serie, numero, estado, fecha_emision, almacenes(nombre), ventas!inner(total, moneda, clientes!inner(nombre))"
          : "tipo_comprobante, serie, numero, estado, fecha_emision, almacenes(nombre), ventas(total, moneda, clientes(nombre))",
      )
      .order("fecha_emision", { ascending: false });

    if (q) query = query.ilike("ventas.clientes.nombre", `%${q}%`);
    if (desdeEfectivo) query = query.gte("fecha_emision", inicioDiaLima(desdeEfectivo));
    if (hastaEfectivo) query = query.lte("fecha_emision", finDiaLima(hastaEfectivo));
    if (estado) query = query.eq("estado", estado);
    if (tipoNumero) query = query.eq("tipo_comprobante", tipoNumero);

    const { data } = await query;
    filasComprobantes = (data ?? []).map((c) => {
      const venta = c.ventas as unknown as {
        total: number;
        moneda: string;
        clientes: { nombre: string } | null;
      } | null;
      const almacen = c.almacenes as unknown as { nombre: string } | null;
      // Misma fórmula que itemsDesdeLineas/construirItemsYTotales: la base
      // imponible sale de dividir el total (con IGV incluido) entre
      // (1 + tasa) y redondear ese resultado — nunca al revés — y el IGV es
      // la diferencia ya redondeada, para que base + IGV cuadre con el total.
      const baseImponible = venta ? Math.round((venta.total / (1 + factorIgv)) * 100) / 100 : null;
      const igv = venta && baseImponible !== null ? Math.round((venta.total - baseImponible) * 100) / 100 : null;
      return {
        tipoComprobante: c.tipo_comprobante,
        serie: c.serie,
        numero: c.numero,
        estado: c.estado,
        fechaEmision: c.fecha_emision,
        clienteNombre: venta?.clientes?.nombre ?? "—",
        almacenNombre: almacen?.nombre ?? "—",
        moneda: venta?.moneda ?? "—",
        baseImponible,
        igv,
        total: venta?.total ?? null,
      };
    });
  }

  let filasGuias: Fila[] = [];

  if (incluirGuiasRemision) {
    let query = supabase
      .from("guias_remision")
      .select(
        q
          ? "tipo_comprobante, serie, numero, estado, fecha_emision, repartos!inner(pedidos!inner(clientes!inner(nombre), almacenes!inner(nombre)))"
          : "tipo_comprobante, serie, numero, estado, fecha_emision, repartos(pedidos(clientes(nombre), almacenes(nombre)))",
      )
      .order("fecha_emision", { ascending: false });

    if (q) query = query.ilike("repartos.pedidos.clientes.nombre", `%${q}%`);
    if (desdeEfectivo) query = query.gte("fecha_emision", inicioDiaLima(desdeEfectivo));
    if (hastaEfectivo) query = query.lte("fecha_emision", finDiaLima(hastaEfectivo));
    if (estado) query = query.eq("estado", estado);

    const { data } = await query;
    filasGuias = (data ?? []).map((g) => {
      const pedido = (
        g.repartos as unknown as {
          pedidos: {
            clientes: { nombre: string } | null;
            almacenes: { nombre: string } | null;
          } | null;
        } | null
      )?.pedidos;
      return {
        tipoComprobante: g.tipo_comprobante,
        serie: g.serie,
        numero: g.numero,
        estado: g.estado,
        fechaEmision: g.fecha_emision,
        clienteNombre: pedido?.clientes?.nombre ?? "—",
        almacenNombre: pedido?.almacenes?.nombre ?? "—",
        moneda: "—",
        baseImponible: null,
        igv: null,
        total: null,
      };
    });
  }

  const filas = [...filasComprobantes, ...filasGuias].sort(
    (a, b) => new Date(b.fechaEmision).getTime() - new Date(a.fechaEmision).getTime(),
  );

  const rows = filas.map((f) => [
    TIPO_COMPROBANTE_LABEL[f.tipoComprobante] ?? "Comprobante",
    `${f.serie}-${f.numero}`,
    f.clienteNombre,
    f.almacenNombre,
    formatFecha(f.fechaEmision),
    f.moneda,
    f.baseImponible,
    f.igv,
    f.total,
    f.estado,
  ]);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Comprobantes");
  sheet.addRow(HEADERS).font = { bold: true };
  sheet.columns = HEADERS.map((h) => ({ width: Math.max(14, h.length + 2) }));
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const row of rows) sheet.addRow(row);
  for (const col of [7, 8, 9]) {
    sheet.getColumn(col).numFmt = "#,##0.00";
  }

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="comprobantes.xlsx"',
    },
  });
}

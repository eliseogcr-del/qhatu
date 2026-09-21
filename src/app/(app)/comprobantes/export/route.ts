import { NextResponse, type NextRequest } from "next/server";
import { formatFecha, hoyLima, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import { buildExcelText } from "@/lib/csv";

const HEADERS = [
  "Tipo de documento",
  "Serie-Número",
  "Cliente",
  "Almacén",
  "Fecha",
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
  totalTexto: string;
};

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  await requireComprobantesAcceso(supabase);

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
      return {
        tipoComprobante: c.tipo_comprobante,
        serie: c.serie,
        numero: c.numero,
        estado: c.estado,
        fechaEmision: c.fecha_emision,
        clienteNombre: venta?.clientes?.nombre ?? "—",
        almacenNombre: almacen?.nombre ?? "—",
        totalTexto: venta ? `${venta.moneda} ${venta.total.toFixed(2)}` : "—",
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
        totalTexto: "—",
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
    f.totalTexto,
    f.estado,
  ]);

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="comprobantes.csv"',
    },
  });
}

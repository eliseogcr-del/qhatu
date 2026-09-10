import { NextResponse, type NextRequest } from "next/server";
import { formatFecha, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { METODO_PAGO_LABEL, TIPO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";
import { buildExcelText } from "@/lib/csv";

const HEADERS = [
  "Cliente",
  "Fecha",
  "Monto",
  "Moneda",
  "Método de pago",
  "Tipo",
  "Referencia",
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
        ? "fecha, monto, moneda, metodo_pago, tipo_pago, referencia, estado, pedidos!inner(clientes!inner(nombre))"
        : "fecha, monto, moneda, metodo_pago, tipo_pago, referencia, estado, pedidos(clientes(nombre))",
    )
    .order("fecha", { ascending: false });

  if (q) query = query.ilike("pedidos.clientes.nombre", `%${q}%`);
  if (desde) query = query.gte("fecha", inicioDiaLima(desde));
  if (hasta) query = query.lte("fecha", finDiaLima(hasta));
  if (metodoPago) query = query.eq("metodo_pago", metodoPago);
  if (tipoPago) query = query.eq("tipo_pago", tipoPago);
  if (estado) query = query.eq("estado", estado);

  const { data: cobranzas } = await query;

  const rows = (cobranzas ?? []).map((c) => {
    const cliente = (
      c.pedidos as unknown as { clientes: { nombre: string } | null } | null
    )?.clientes;
    return [
      cliente?.nombre ?? "—",
      formatFecha(c.fecha),
      c.monto,
      c.moneda,
      METODO_PAGO_LABEL[c.metodo_pago as MetodoPago] ?? c.metodo_pago,
      TIPO_PAGO_LABEL[c.tipo_pago] ?? c.tipo_pago,
      c.referencia ?? "—",
      c.estado === "anulada" ? "Anulada" : "Activa",
    ];
  });

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="cobranzas.csv"',
    },
  });
}

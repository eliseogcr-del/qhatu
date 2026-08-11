import { NextResponse, type NextRequest } from "next/server";
import { formatFecha } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { ESTADO_LABEL, canalLabel, type EstadoPedido } from "@/lib/pedido-estados";
import { buildExcelText } from "@/lib/csv";

const HEADERS = [
  "Cliente",
  "Canal",
  "Fecha",
  "Entrega requerida",
  "Estado",
  "Moneda",
  "Total",
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
  const estado = params.get("estado");

  let query = supabase
    .from("pedidos")
    .select(
      q
        ? "fecha, fecha_entrega_requerida, canal_pedido, estado, moneda, total, clientes!inner(nombre)"
        : "fecha, fecha_entrega_requerida, canal_pedido, estado, moneda, total, clientes(nombre)",
    )
    .order("fecha", { ascending: false });
  if (q) query = query.ilike("clientes.nombre", `%${q}%`);
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", `${hasta}T23:59:59`);
  if (estado) query = query.eq("estado", estado);

  const { data: pedidos } = await query;

  const rows = (pedidos ?? []).map((p) => {
    const cliente = (p.clientes as unknown as { nombre: string } | null)?.nombre;
    const estado = p.estado as EstadoPedido;
    return [
      cliente,
      canalLabel(p.canal_pedido),
      formatFecha(p.fecha),
      p.fecha_entrega_requerida,
      ESTADO_LABEL[estado] ?? p.estado,
      p.moneda,
      p.total,
    ];
  });

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="pedidos.csv"',
    },
  });
}

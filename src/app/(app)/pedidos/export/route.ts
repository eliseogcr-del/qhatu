import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { ESTADO_LABEL, canalLabel, type EstadoPedido } from "@/lib/pedido-estados";
import { buildCsv } from "@/lib/csv";

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

  const q = request.nextUrl.searchParams.get("q");

  let query = supabase
    .from("pedidos")
    .select(
      q
        ? "fecha, fecha_entrega_requerida, canal_pedido, estado, moneda, total, clientes!inner(nombre)"
        : "fecha, fecha_entrega_requerida, canal_pedido, estado, moneda, total, clientes(nombre)",
    )
    .order("fecha", { ascending: false });
  if (q) query = query.ilike("clientes.nombre", `%${q}%`);

  const { data: pedidos } = await query;

  const rows = (pedidos ?? []).map((p) => {
    const cliente = (p.clientes as unknown as { nombre: string } | null)?.nombre;
    const estado = p.estado as EstadoPedido;
    return [
      cliente,
      canalLabel(p.canal_pedido),
      new Date(p.fecha).toLocaleDateString("es-PE"),
      p.fecha_entrega_requerida,
      ESTADO_LABEL[estado] ?? p.estado,
      p.moneda,
      p.total,
    ];
  });

  const csv = buildCsv(HEADERS, rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pedidos.csv"',
    },
  });
}

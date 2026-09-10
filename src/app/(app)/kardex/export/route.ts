import { NextResponse, type NextRequest } from "next/server";
import { formatFechaHora, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { createClient } from "@/utils/supabase/server";
import { TIPO_MOVIMIENTO_LABEL, type TipoMovimiento } from "@/lib/kardex-tipos";
import { buildExcelText } from "@/lib/csv";

const HEADERS = [
  "Fecha",
  "Producto",
  "Almacén",
  "Tipo",
  "Cantidad",
  "Saldo resultante",
  "Usuario",
  "Detalle",
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
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  const productoId = params.get("producto_id");
  const almacenId = params.get("almacen_id");
  const tipo = params.get("tipo");

  let query = supabase
    .from("kardex_movimientos")
    .select(
      "fecha, tipo_movimiento, cantidad, saldo_resultante, detalle, productos(nombre), almacenes(nombre), usuarios(nombre)",
    )
    .order("fecha", { ascending: false });

  if (desde) query = query.gte("fecha", inicioDiaLima(desde));
  if (hasta) query = query.lte("fecha", finDiaLima(hasta));
  if (productoId) query = query.eq("producto_id", productoId);
  if (almacenId) query = query.eq("almacen_id", almacenId);
  if (tipo) query = query.eq("tipo_movimiento", tipo);

  const { data: movimientos } = await query;

  const rows = (movimientos ?? []).map((m) => {
    const producto = m.productos as unknown as { nombre: string } | null;
    const almacen = m.almacenes as unknown as { nombre: string } | null;
    const usuario = m.usuarios as unknown as { nombre: string | null } | null;
    return [
      formatFechaHora(m.fecha),
      producto?.nombre ?? "—",
      almacen?.nombre ?? "—",
      TIPO_MOVIMIENTO_LABEL[m.tipo_movimiento as TipoMovimiento] ?? m.tipo_movimiento,
      m.cantidad,
      m.saldo_resultante,
      usuario?.nombre ?? "—",
      m.detalle ?? "—",
    ];
  });

  const body = buildExcelText(HEADERS, rows);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-16le",
      "Content-Disposition": 'attachment; filename="kardex.csv"',
    },
  });
}

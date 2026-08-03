import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { ESTADO_LABEL, canalLabel, type EstadoPedido } from "@/lib/pedido-estados";

const HEADERS = [
  "Cliente",
  "Canal",
  "Fecha",
  "Entrega requerida",
  "Estado",
  "Moneda",
  "Total",
];

function csvEscape(value: unknown) {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

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
      csvEscape(cliente),
      csvEscape(canalLabel(p.canal_pedido)),
      csvEscape(new Date(p.fecha).toLocaleDateString("es-PE")),
      csvEscape(p.fecha_entrega_requerida),
      csvEscape(ESTADO_LABEL[estado] ?? p.estado),
      csvEscape(p.moneda),
      csvEscape(p.total),
    ].join(",");
  });

  const csv = "﻿" + [HEADERS.join(","), ...rows].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pedidos.csv"',
    },
  });
}

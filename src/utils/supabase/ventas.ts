import { createClient } from "./server";

export type VentaConSaldo = {
  id: string;
  fecha: string;
  moneda: string;
  total: number;
  estado: string;
  cliente_nombre: string | null;
  cobrado: number;
  saldo: number;
};

export type VentasFiltro = {
  clienteNombre?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  soloPendientes?: boolean;
};

// Comparte la lógica de filtrado + cálculo de saldo pendiente entre el
// listado de ventas y su exportación a Excel, para que ambos vean
// exactamente los mismos datos.
export async function fetchVentasConSaldo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { clienteNombre, fechaDesde, fechaHasta, soloPendientes }: VentasFiltro,
): Promise<{ ventas: VentaConSaldo[]; error: string | null }> {
  let query = supabase
    .from("ventas")
    .select(
      clienteNombre
        ? "id, fecha, moneda, total, estado, clientes!inner(nombre)"
        : "id, fecha, moneda, total, estado, clientes(nombre)",
    )
    .order("fecha", { ascending: false });

  if (clienteNombre) query = query.ilike("clientes.nombre", `%${clienteNombre}%`);
  if (fechaDesde) query = query.gte("fecha", fechaDesde);
  if (fechaHasta) query = query.lte("fecha", `${fechaHasta}T23:59:59`);

  const { data: ventas, error } = await query;
  if (error || !ventas) {
    return { ventas: [], error: error?.message ?? null };
  }

  const ventaIds = ventas.map((v) => v.id);
  const { data: cobranzas } =
    ventaIds.length > 0
      ? await supabase.from("cobranzas").select("venta_id, monto").in("venta_id", ventaIds)
      : { data: [] as { venta_id: string; monto: number }[] };

  const cobradoPorVenta = new Map<string, number>();
  for (const c of cobranzas ?? []) {
    cobradoPorVenta.set(c.venta_id, (cobradoPorVenta.get(c.venta_id) ?? 0) + c.monto);
  }

  const resultado = ventas.map((v) => {
    const cobrado = cobradoPorVenta.get(v.id) ?? 0;
    return {
      id: v.id,
      fecha: v.fecha,
      moneda: v.moneda,
      total: v.total,
      estado: v.estado,
      cliente_nombre:
        (v.clientes as unknown as { nombre: string } | null)?.nombre ?? null,
      cobrado,
      saldo: Math.round((v.total - cobrado) * 100) / 100,
    };
  });

  return {
    ventas: soloPendientes ? resultado.filter((v) => v.saldo > 0) : resultado,
    error: null,
  };
}

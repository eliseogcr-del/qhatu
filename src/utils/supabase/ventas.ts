import { createClient } from "./server";
import { inicioDiaLima, finDiaLima } from "@/lib/fecha";

export type PagoDetalle = {
  fecha: string;
  monto: number;
  metodoPago: string;
  usuarioNombre: string | null;
};

export type VentaConSaldo = {
  id: string;
  fecha: string;
  moneda: string;
  total: number;
  estado: string;
  cliente_nombre: string | null;
  almacen_nombre: string | null;
  cobrado: number;
  saldo: number;
  pagos: PagoDetalle[];
};

export type VentasFiltro = {
  clienteNombre?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  soloPendientes?: boolean;
  almacenId?: string | null;
  // Un vendedor no es una columna propia de ventas — se resuelve a su
  // almacén fijo (usuarios.almacen_id) y se filtra por ese almacén, igual
  // que el reporte de ventas por vendedor.
  vendedorId?: string | null;
};

// Comparte la lógica de filtrado + cálculo de saldo pendiente entre el
// listado de ventas y su exportación a Excel, para que ambos vean
// exactamente los mismos datos.
export async function fetchVentasConSaldo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { clienteNombre, fechaDesde, fechaHasta, soloPendientes, almacenId, vendedorId }: VentasFiltro,
): Promise<{ ventas: VentaConSaldo[]; error: string | null }> {
  let query = supabase
    .from("ventas")
    .select(
      clienteNombre
        ? "id, fecha, moneda, total, estado, clientes!inner(nombre), almacenes(nombre)"
        : "id, fecha, moneda, total, estado, clientes(nombre), almacenes(nombre)",
    )
    .order("fecha", { ascending: false });

  if (clienteNombre) query = query.ilike("clientes.nombre", `%${clienteNombre}%`);
  if (fechaDesde) query = query.gte("fecha", inicioDiaLima(fechaDesde));
  if (fechaHasta) query = query.lte("fecha", finDiaLima(fechaHasta));
  if (almacenId) query = query.eq("almacen_id", almacenId);
  if (vendedorId) {
    const { data: vendedor } = await supabase
      .from("usuarios")
      .select("almacen_id")
      .eq("id", vendedorId)
      .maybeSingle();
    query = query.eq("almacen_id", vendedor?.almacen_id ?? "00000000-0000-0000-0000-000000000000");
  }

  const { data: ventas, error } = await query;
  if (error || !ventas) {
    return { ventas: [], error: error?.message ?? null };
  }

  const ventaIds = ventas.map((v) => v.id);
  const { data: cobranzas } =
    ventaIds.length > 0
      ? await supabase
          .from("cobranzas")
          .select("venta_id, monto, fecha, metodo_pago, usuarios(nombre)")
          .in("venta_id", ventaIds)
          .eq("estado", "activa")
          .order("fecha", { ascending: true })
      : {
          data: [] as {
            venta_id: string;
            monto: number;
            fecha: string;
            metodo_pago: string;
            usuarios: { nombre: string | null } | null;
          }[],
        };

  const cobradoPorVenta = new Map<string, number>();
  const pagosPorVenta = new Map<string, PagoDetalle[]>();
  for (const c of cobranzas ?? []) {
    cobradoPorVenta.set(c.venta_id, (cobradoPorVenta.get(c.venta_id) ?? 0) + c.monto);
    const lista = pagosPorVenta.get(c.venta_id) ?? [];
    lista.push({
      fecha: c.fecha,
      monto: c.monto,
      metodoPago: c.metodo_pago,
      usuarioNombre: (c.usuarios as unknown as { nombre: string | null } | null)?.nombre ?? null,
    });
    pagosPorVenta.set(c.venta_id, lista);
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
      almacen_nombre:
        (v.almacenes as unknown as { nombre: string } | null)?.nombre ?? null,
      cobrado,
      saldo: Math.round((v.total - cobrado) * 100) / 100,
      pagos: pagosPorVenta.get(v.id) ?? [],
    };
  });

  return {
    ventas: soloPendientes ? resultado.filter((v) => v.saldo > 0) : resultado,
    error: null,
  };
}

// Saldo pendiente de una venta puntual (solo cobranzas activas cuentan).
export async function getSaldoVenta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ventaId: string,
  total: number,
): Promise<number> {
  const { data: cobranzas } = await supabase
    .from("cobranzas")
    .select("monto")
    .eq("venta_id", ventaId)
    .eq("estado", "activa");

  const cobrado = (cobranzas ?? []).reduce((acc, c) => acc + c.monto, 0);
  return Math.round((total - cobrado) * 100) / 100;
}

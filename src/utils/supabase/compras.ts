import { createClient } from "./server";
import { inicioDiaLima, finDiaLima } from "@/lib/fecha";

export type PagoDetalle = {
  fecha: string;
  monto: number;
  metodoPago: string;
  usuarioNombre: string | null;
};

export type CompraConSaldo = {
  id: string;
  fecha: string;
  moneda: string;
  total: number;
  estado: string;
  origen: string;
  validado: boolean;
  proveedor_nombre: string | null;
  almacen_nombre: string | null;
  pagado: number;
  saldo: number;
  pagos: PagoDetalle[];
};

export type ComprasFiltro = {
  proveedorNombre?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  soloPendientes?: boolean;
};

// Espeja fetchVentasConSaldo (utils/supabase/ventas.ts): comparte la
// lógica de filtrado + cálculo de saldo entre el listado y su export.
export async function fetchComprasConSaldo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { proveedorNombre, fechaDesde, fechaHasta, soloPendientes }: ComprasFiltro,
): Promise<{ compras: CompraConSaldo[]; error: string | null }> {
  let query = supabase
    .from("compras")
    .select(
      proveedorNombre
        ? "id, fecha, moneda, total, estado, origen, validado, proveedores!inner(nombre), almacenes(nombre)"
        : "id, fecha, moneda, total, estado, origen, validado, proveedores(nombre), almacenes(nombre)",
    )
    .order("fecha", { ascending: false });

  if (proveedorNombre) query = query.ilike("proveedores.nombre", `%${proveedorNombre}%`);
  if (fechaDesde) query = query.gte("fecha", inicioDiaLima(fechaDesde));
  if (fechaHasta) query = query.lte("fecha", finDiaLima(fechaHasta));

  const { data: compras, error } = await query;
  if (error || !compras) {
    return { compras: [], error: error?.message ?? null };
  }

  const compraIds = compras.map((c) => c.id);
  const { data: pagos } =
    compraIds.length > 0
      ? await supabase
          .from("pagos_proveedor")
          .select("compra_id, monto, fecha, metodo_pago, usuarios(nombre)")
          .in("compra_id", compraIds)
          .eq("estado", "activa")
          .order("fecha", { ascending: true })
      : {
          data: [] as {
            compra_id: string;
            monto: number;
            fecha: string;
            metodo_pago: string;
            usuarios: { nombre: string | null } | null;
          }[],
        };

  const pagadoPorCompra = new Map<string, number>();
  const pagosPorCompra = new Map<string, PagoDetalle[]>();
  for (const p of pagos ?? []) {
    pagadoPorCompra.set(p.compra_id, (pagadoPorCompra.get(p.compra_id) ?? 0) + p.monto);
    const lista = pagosPorCompra.get(p.compra_id) ?? [];
    lista.push({
      fecha: p.fecha,
      monto: p.monto,
      metodoPago: p.metodo_pago,
      usuarioNombre: (p.usuarios as unknown as { nombre: string | null } | null)?.nombre ?? null,
    });
    pagosPorCompra.set(p.compra_id, lista);
  }

  const resultado = compras.map((c) => {
    const pagado = pagadoPorCompra.get(c.id) ?? 0;
    return {
      id: c.id,
      fecha: c.fecha,
      moneda: c.moneda,
      total: c.total,
      estado: c.estado,
      origen: c.origen,
      validado: c.validado,
      proveedor_nombre:
        (c.proveedores as unknown as { nombre: string } | null)?.nombre ?? null,
      almacen_nombre:
        (c.almacenes as unknown as { nombre: string } | null)?.nombre ?? null,
      pagado,
      saldo: Math.round((c.total - pagado) * 100) / 100,
      pagos: pagosPorCompra.get(c.id) ?? [],
    };
  });

  return {
    compras: soloPendientes ? resultado.filter((c) => c.saldo > 0) : resultado,
    error: null,
  };
}

// Saldo pendiente de una compra puntual (solo pagos activos cuentan).
export async function getSaldoCompra(
  supabase: Awaited<ReturnType<typeof createClient>>,
  compraId: string,
  total: number,
): Promise<number> {
  const { data: pagos } = await supabase
    .from("pagos_proveedor")
    .select("monto")
    .eq("compra_id", compraId)
    .eq("estado", "activa");

  const pagado = (pagos ?? []).reduce((acc, p) => acc + p.monto, 0);
  return Math.round((total - pagado) * 100) / 100;
}

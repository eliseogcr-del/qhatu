import { createClient } from "./server";
import { inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { TIPO_NOTA_VENTA } from "@/lib/comprobante-links";

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
  descuento: number;
  estado: string;
  cliente_nombre: string | null;
  almacen_nombre: string | null;
  vendedor_nombre: string | null;
  cobrado: number;
  saldo: number;
  pagos: PagoDetalle[];
  // El comprobante "real" emitido para esta venta — factura/boleta si hay
  // una, si no la nota de venta (documento interno). null si aún no se
  // emitió ninguno.
  comprobante_tipo: number | null;
  comprobante_numero: string | null;
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
        ? "id, fecha, moneda, total, descuento, estado, clientes!inner(nombre), almacenes(nombre), pedidos(usuarios(nombre))"
        : "id, fecha, moneda, total, descuento, estado, clientes(nombre), almacenes(nombre), pedidos(usuarios(nombre))",
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

  const { data: comprobantes } =
    ventaIds.length > 0
      ? await supabase
          .from("comprobantes")
          .select("venta_id, tipo_comprobante, serie, numero")
          .in("venta_id", ventaIds)
          .eq("estado", "emitido")
      : { data: [] as { venta_id: string; tipo_comprobante: number; serie: string; numero: number }[] };

  // Si hay varios comprobantes emitidos para la misma venta (ej. nota de
  // venta + boleta), la factura/boleta manda sobre la nota de venta — es
  // el documento "real" ante SUNAT.
  const comprobantePorVenta = new Map<string, { tipo: number; serie: string; numero: number }>();
  for (const c of comprobantes ?? []) {
    const actual = comprobantePorVenta.get(c.venta_id);
    if (!actual || (actual.tipo === TIPO_NOTA_VENTA && c.tipo_comprobante !== TIPO_NOTA_VENTA)) {
      comprobantePorVenta.set(c.venta_id, {
        tipo: c.tipo_comprobante,
        serie: c.serie,
        numero: c.numero,
      });
    }
  }

  const resultado = ventas.map((v) => {
    const cobrado = cobradoPorVenta.get(v.id) ?? 0;
    const comprobante = comprobantePorVenta.get(v.id);
    return {
      id: v.id,
      fecha: v.fecha,
      moneda: v.moneda,
      total: v.total,
      descuento: v.descuento,
      estado: v.estado,
      cliente_nombre:
        (v.clientes as unknown as { nombre: string } | null)?.nombre ?? null,
      almacen_nombre:
        (v.almacenes as unknown as { nombre: string } | null)?.nombre ?? null,
      vendedor_nombre:
        (v.pedidos as unknown as { usuarios: { nombre: string | null } | null } | null)?.usuarios
          ?.nombre ?? null,
      cobrado,
      saldo: Math.round((v.total - v.descuento - cobrado) * 100) / 100,
      pagos: pagosPorVenta.get(v.id) ?? [],
      comprobante_tipo: comprobante?.tipo ?? null,
      comprobante_numero: comprobante ? `${comprobante.serie}-${comprobante.numero}` : null,
    };
  });

  return {
    ventas: soloPendientes ? resultado.filter((v) => v.saldo > 0) : resultado,
    error: null,
  };
}

export type DetalleProductoVendido = {
  id: string;
  ventaId: string;
  fecha: string;
  moneda: string;
  comprobanteTipo: number | null;
  comprobanteNumero: string | null;
  productoNombre: string;
  unidadMedida: string | null;
  cantidad: number;
  precioUnitario: number;
  importe: number;
  almacenNombre: string | null;
};

export type DetalleProductosFiltro = {
  productoId?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  almacenId?: string | null;
};

// Una fila por línea de producto vendido (no por venta), para el reporte
// "Productos vendidos" — misma lógica de precedencia de comprobante
// (factura/boleta manda sobre la nota de venta) que fetchVentasConSaldo.
export async function fetchDetalleProductosVendidos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  { productoId, fechaDesde, fechaHasta, almacenId }: DetalleProductosFiltro,
): Promise<{ filas: DetalleProductoVendido[]; error: string | null }> {
  let ventasQuery = supabase
    .from("ventas")
    .select("id, fecha, moneda, almacenes(nombre)")
    .neq("estado", "anulada");
  if (fechaDesde) ventasQuery = ventasQuery.gte("fecha", inicioDiaLima(fechaDesde));
  if (fechaHasta) ventasQuery = ventasQuery.lte("fecha", finDiaLima(fechaHasta));
  if (almacenId) ventasQuery = ventasQuery.eq("almacen_id", almacenId);

  const { data: ventas, error } = await ventasQuery;
  if (error || !ventas) {
    return { filas: [], error: error?.message ?? null };
  }

  const ventaIds = ventas.map((v) => v.id);
  if (ventaIds.length === 0) return { filas: [], error: null };

  const ventaPorId = new Map(
    ventas.map((v) => [
      v.id,
      {
        fecha: v.fecha,
        moneda: v.moneda,
        almacenNombre: (v.almacenes as unknown as { nombre: string } | null)?.nombre ?? null,
      },
    ]),
  );

  let detalleQuery = supabase
    .from("venta_detalle")
    .select(
      "id, venta_id, cantidad_entregada, precio_unitario, subtotal, productos(nombre), unidades_medida(descripcion)",
    )
    .in("venta_id", ventaIds)
    .gt("cantidad_entregada", 0);
  if (productoId) detalleQuery = detalleQuery.eq("producto_id", productoId);

  const [{ data: detalle }, { data: comprobantes }] = await Promise.all([
    detalleQuery,
    supabase
      .from("comprobantes")
      .select("venta_id, tipo_comprobante, serie, numero")
      .in("venta_id", ventaIds)
      .eq("estado", "emitido"),
  ]);

  const comprobantePorVenta = new Map<string, { tipo: number; serie: string; numero: number }>();
  for (const c of comprobantes ?? []) {
    const actual = comprobantePorVenta.get(c.venta_id);
    if (!actual || (actual.tipo === TIPO_NOTA_VENTA && c.tipo_comprobante !== TIPO_NOTA_VENTA)) {
      comprobantePorVenta.set(c.venta_id, {
        tipo: c.tipo_comprobante,
        serie: c.serie,
        numero: c.numero,
      });
    }
  }

  const filas = (detalle ?? [])
    .map((d) => {
      const venta = ventaPorId.get(d.venta_id);
      const comprobante = comprobantePorVenta.get(d.venta_id);
      const producto = d.productos as unknown as { nombre: string } | null;
      const unidad = d.unidades_medida as unknown as { descripcion: string } | null;
      return {
        id: d.id,
        ventaId: d.venta_id,
        fecha: venta?.fecha ?? "",
        moneda: venta?.moneda ?? "PEN",
        comprobanteTipo: comprobante?.tipo ?? null,
        comprobanteNumero: comprobante
          ? `${comprobante.serie}-${String(comprobante.numero).padStart(6, "0")}`
          : null,
        productoNombre: producto?.nombre ?? "—",
        unidadMedida: unidad?.descripcion ?? null,
        cantidad: d.cantidad_entregada,
        precioUnitario: d.precio_unitario,
        importe: d.subtotal,
        almacenNombre: venta?.almacenNombre ?? null,
      };
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

  return { filas, error: null };
}

// Saldo pendiente de una venta puntual (solo cobranzas activas cuentan).
export async function getSaldoVenta(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ventaId: string,
  total: number,
  descuento = 0,
): Promise<number> {
  const { data: cobranzas } = await supabase
    .from("cobranzas")
    .select("monto")
    .eq("venta_id", ventaId)
    .eq("estado", "activa");

  const cobrado = (cobranzas ?? []).reduce((acc, c) => acc + c.monto, 0);
  return Math.round((total - descuento - cobrado) * 100) / 100;
}

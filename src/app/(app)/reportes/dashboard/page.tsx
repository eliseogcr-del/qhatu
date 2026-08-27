import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { hoyLima, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import ReportesDashboardFiltroForm from "@/components/ReportesDashboardFiltroForm";
import ReportesDashboardVendedores, {
  type VendedorResumen,
  type ProductoDetalle,
} from "@/components/ReportesDashboardVendedores";

type ClienteResumen = {
  clienteId: string;
  nombre: string;
  totalVentas: number;
  totalPagado: number;
  totalAdeudado: number;
};

type TopProducto = {
  productoId: string;
  nombre: string;
  cantidad: number;
};

const MONEDA = "PEN";

export default async function ReportesDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const supabase = await createClient();

  // Sin parámetros en la URL (primera carga): del 1° del mes en curso a
  // hoy. Si el usuario vacía los campos, se respeta tal cual (aquí sí
  // tiene sentido "todo", a diferencia de otros listados).
  const hoy = hoyLima();
  const primerDiaMes = `${hoy.slice(0, 7)}-01`;
  const desdeEfectivo = desde === undefined ? primerDiaMes : desde;
  const hastaEfectivo = hasta === undefined ? hoy : hasta;

  let ventasQuery = supabase
    .from("ventas")
    .select(
      "id, total, descuento, cliente_id, clientes(nombre), pedidos(usuario_id, usuarios(nombre))",
    )
    .neq("estado", "anulada");
  if (desdeEfectivo) ventasQuery = ventasQuery.gte("fecha", inicioDiaLima(desdeEfectivo));
  if (hastaEfectivo) ventasQuery = ventasQuery.lte("fecha", finDiaLima(hastaEfectivo));
  const { data: ventas, error } = await ventasQuery;

  const ventaIds = (ventas ?? []).map((v) => v.id);

  const [{ data: cobranzas }, { data: detalleVentas }] = await Promise.all([
    ventaIds.length > 0
      ? supabase
          .from("cobranzas")
          .select("venta_id, monto")
          .in("venta_id", ventaIds)
          .eq("estado", "activa")
      : Promise.resolve({ data: [] as { venta_id: string | null; monto: number }[] }),
    ventaIds.length > 0
      ? supabase
          .from("venta_detalle")
          .select("venta_id, producto_id, cantidad_entregada, subtotal, productos(nombre)")
          .in("venta_id", ventaIds)
          .gt("cantidad_entregada", 0)
      : Promise.resolve({
          data: [] as {
            venta_id: string;
            producto_id: string;
            cantidad_entregada: number;
            subtotal: number;
            productos: { nombre: string } | null;
          }[],
        }),
  ]);

  const cobradoPorVenta = new Map<string, number>();
  for (const c of cobranzas ?? []) {
    if (!c.venta_id) continue;
    cobradoPorVenta.set(c.venta_id, (cobradoPorVenta.get(c.venta_id) ?? 0) + c.monto);
  }

  // Snapshot por venta: quién la vendió, a qué cliente, y qué fracción de
  // su neto ya está cobrada — esa fracción se usa después para prorratear
  // "importe pagado/adeudado" a nivel de línea de producto, ya que los
  // cobros se registran por venta completa, no por línea.
  type VentaInfo = {
    usuarioId: string;
    usuarioNombre: string;
    clienteId: string;
    clienteNombre: string;
    neto: number;
    cobrado: number;
    factorPagado: number;
  };
  const ventaInfoMap = new Map<string, VentaInfo>();
  for (const v of ventas ?? []) {
    const pedido = v.pedidos as unknown as {
      usuario_id: string;
      usuarios: { nombre: string | null } | null;
    } | null;
    const cliente = v.clientes as unknown as { nombre: string } | null;
    const cobrado = cobradoPorVenta.get(v.id) ?? 0;
    const neto = Math.round((v.total - v.descuento) * 100) / 100;
    const factorPagado = neto > 0 ? Math.min(cobrado / neto, 1) : 0;
    ventaInfoMap.set(v.id, {
      usuarioId: pedido?.usuario_id ?? "sin-vendedor",
      usuarioNombre: pedido?.usuarios?.nombre ?? "Sin vendedor",
      clienteId: v.cliente_id,
      clienteNombre: cliente?.nombre ?? "—",
      neto,
      cobrado,
      factorPagado,
    });
  }

  // Ventas por vendedor.
  const vendedoresMap = new Map<string, VendedorResumen>();
  for (const info of ventaInfoMap.values()) {
    const fila = vendedoresMap.get(info.usuarioId) ?? {
      usuarioId: info.usuarioId,
      nombre: info.usuarioNombre,
      totalVentas: 0,
      totalPagado: 0,
      totalAdeudado: 0,
    };
    fila.totalVentas = Math.round((fila.totalVentas + info.neto) * 100) / 100;
    fila.totalPagado = Math.round((fila.totalPagado + info.cobrado) * 100) / 100;
    vendedoresMap.set(info.usuarioId, fila);
  }
  const vendedores = [...vendedoresMap.values()]
    .map((f) => ({ ...f, totalAdeudado: Math.round((f.totalVentas - f.totalPagado) * 100) / 100 }))
    .sort((a, b) => b.totalVentas - a.totalVentas);

  // Ventas por cliente.
  const clientesMap = new Map<string, ClienteResumen>();
  for (const info of ventaInfoMap.values()) {
    const fila = clientesMap.get(info.clienteId) ?? {
      clienteId: info.clienteId,
      nombre: info.clienteNombre,
      totalVentas: 0,
      totalPagado: 0,
      totalAdeudado: 0,
    };
    fila.totalVentas = Math.round((fila.totalVentas + info.neto) * 100) / 100;
    fila.totalPagado = Math.round((fila.totalPagado + info.cobrado) * 100) / 100;
    clientesMap.set(info.clienteId, fila);
  }
  const clientes = [...clientesMap.values()]
    .map((f) => ({ ...f, totalAdeudado: Math.round((f.totalVentas - f.totalPagado) * 100) / 100 }))
    .sort((a, b) => b.totalVentas - a.totalVentas);

  // Detalle de productos por vendedor (el drill-down al hacer click).
  const detalleMap = new Map<string, Map<string, ProductoDetalle>>();
  // Top 5 productos más vendidos en cantidad, para todo el rango.
  const topMap = new Map<string, TopProducto>();

  for (const d of detalleVentas ?? []) {
    const info = ventaInfoMap.get(d.venta_id);
    if (!info) continue;
    const productoNombre = (d.productos as unknown as { nombre: string } | null)?.nombre ?? "—";

    const porVendedor = detalleMap.get(info.usuarioId) ?? new Map<string, ProductoDetalle>();
    const fila = porVendedor.get(d.producto_id) ?? {
      productoId: d.producto_id,
      nombre: productoNombre,
      cantidad: 0,
      importeVendido: 0,
      importePagado: 0,
      importeAdeudado: 0,
    };
    const importePagadoLinea = Math.round(d.subtotal * info.factorPagado * 100) / 100;
    fila.cantidad = Math.round((fila.cantidad + d.cantidad_entregada) * 100) / 100;
    fila.importeVendido = Math.round((fila.importeVendido + d.subtotal) * 100) / 100;
    fila.importePagado = Math.round((fila.importePagado + importePagadoLinea) * 100) / 100;
    fila.importeAdeudado = Math.round((fila.importeVendido - fila.importePagado) * 100) / 100;
    porVendedor.set(d.producto_id, fila);
    detalleMap.set(info.usuarioId, porVendedor);

    const top = topMap.get(d.producto_id) ?? {
      productoId: d.producto_id,
      nombre: productoNombre,
      cantidad: 0,
    };
    top.cantidad = Math.round((top.cantidad + d.cantidad_entregada) * 100) / 100;
    topMap.set(d.producto_id, top);
  }

  const detallePorVendedor: Record<string, ProductoDetalle[]> = {};
  for (const [usuarioId, mapa] of detalleMap.entries()) {
    detallePorVendedor[usuarioId] = [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad);
  }

  const topProductos = [...topMap.values()].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard del negocio</h1>
          <Link
            href="/reportes"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver a reportes
          </Link>
        </div>

        <ReportesDashboardFiltroForm desde={desdeEfectivo} hasta={hastaEfectivo} />

        <p className="mb-6 text-xs text-gray-400">
          Los montos asumen una sola moneda por simplicidad (no convierten
          PEN/USD). Las ventas anuladas no se cuentan.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ReportesDashboardVendedores
            vendedores={vendedores}
            detallePorVendedor={detallePorVendedor}
            moneda={MONEDA}
          />

          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Ventas por cliente
              </h2>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-bold">Cliente</th>
                      <th className="px-4 py-3 text-right font-bold">Total ventas</th>
                      <th className="px-4 py-3 text-right font-bold">Total pagado</th>
                      <th className="px-4 py-3 text-right font-bold">Total adeudado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c) => (
                      <tr key={c.clienteId} className="border-b-2 border-gray-200 last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-900">{c.nombre}</td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {MONEDA} {c.totalVentas.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {MONEDA} {c.totalPagado.toFixed(2)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${
                            c.totalAdeudado > 0.009 ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {MONEDA} {c.totalAdeudado.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {clientes.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                          Sin ventas en este rango.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Top 5 productos más vendidos (cantidad)
              </h2>
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-3 font-bold">Producto</th>
                      <th className="px-4 py-3 text-right font-bold">Cantidad vendida</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProductos.map((p) => (
                      <tr key={p.productoId} className="border-b-2 border-gray-200 last:border-0">
                        <td className="px-4 py-3 font-medium text-gray-900">{p.nombre}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{p.cantidad}</td>
                      </tr>
                    ))}
                    {topProductos.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-4 py-10 text-center text-gray-400">
                          Sin ventas en este rango.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

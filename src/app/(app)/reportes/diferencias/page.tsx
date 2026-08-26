import Link from "next/link";
import { formatFecha, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import ReportesDiferenciasFiltroForm from "@/components/ReportesDiferenciasFiltroForm";

type ProductoDiferencia = {
  productoId: string;
  nombre: string;
  pedida: number;
  vendida: number;
};

type PedidoConDiferencias = {
  ventaId: string;
  pedidoId: string;
  fecha: string;
  clienteNombre: string;
  productos: ProductoDiferencia[];
};

export default async function DiferenciasPedidoVentaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("ventas")
    .select(
      "id, fecha, estado, pedidos(id, fecha, clientes(nombre), pedido_detalle(producto_id, cantidad, productos(nombre))), venta_detalle(producto_id, cantidad_entregada, productos(nombre))",
    )
    .neq("estado", "anulada")
    .order("fecha", { ascending: false })
    .limit(300);

  if (desde) query = query.gte("fecha", inicioDiaLima(desde));
  if (hasta) query = query.lte("fecha", finDiaLima(hasta));

  const { data: ventas, error } = await query;

  const pedidosConDiferencias: PedidoConDiferencias[] = (ventas ?? [])
    .map((v) => {
      const pedido = v.pedidos as unknown as {
        id: string;
        fecha: string;
        clientes: { nombre: string } | null;
        pedido_detalle: {
          producto_id: string;
          cantidad: number;
          productos: { nombre: string } | null;
        }[];
      } | null;
      const ventaDetalle = v.venta_detalle as unknown as {
        producto_id: string;
        cantidad_entregada: number;
        productos: { nombre: string } | null;
      }[];

      if (!pedido) return null;

      const mapa = new Map<string, ProductoDiferencia>();
      for (const pd of pedido.pedido_detalle) {
        mapa.set(pd.producto_id, {
          productoId: pd.producto_id,
          nombre: pd.productos?.nombre ?? "—",
          pedida: pd.cantidad,
          vendida: 0,
        });
      }
      for (const vd of ventaDetalle) {
        const existente = mapa.get(vd.producto_id);
        if (existente) {
          existente.vendida = vd.cantidad_entregada;
        } else {
          mapa.set(vd.producto_id, {
            productoId: vd.producto_id,
            nombre: vd.productos?.nombre ?? "—",
            pedida: 0,
            vendida: vd.cantidad_entregada,
          });
        }
      }

      const productos = [...mapa.values()].filter((p) => p.pedida !== p.vendida);
      if (productos.length === 0) return null;

      return {
        ventaId: v.id,
        pedidoId: pedido.id,
        fecha: pedido.fecha,
        clienteNombre: pedido.clientes?.nombre ?? "—",
        productos,
      };
    })
    .filter((x): x is PedidoConDiferencias => x !== null);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Diferencias entre pedido y venta
          </h1>
          <Link
            href="/reportes"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver a reportes
          </Link>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Solo se muestran los pedidos donde lo entregado en la venta no
          coincide con lo pedido originalmente — ya sea porque cambió la
          cantidad de un producto, o porque se agregó un producto que no
          estaba en el pedido.
        </p>

        <ReportesDiferenciasFiltroForm
          desde={desde ?? ""}
          hasta={hasta ?? ""}
          hayFiltros={!!(desde || hasta)}
        />

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="space-y-4">
          {pedidosConDiferencias.map((p) => (
            <div
              key={p.ventaId}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{p.clienteNombre}</p>
                  <p className="text-xs text-gray-500">
                    {formatFecha(p.fecha)}
                  </p>
                </div>
                <Link
                  href={`/ventas/${p.ventaId}`}
                  className="text-sm font-medium text-emerald-700 hover:underline"
                >
                  Ver venta
                </Link>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
                  <tr>
                    <th className="px-4 py-2 font-bold">Producto</th>
                    <th className="px-4 py-2 font-bold">Pedido</th>
                    <th className="px-4 py-2 font-bold">Vendido</th>
                    <th className="px-4 py-2 font-bold">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {p.productos.map((prod) => {
                    const diferencia = prod.vendida - prod.pedida;
                    const esNuevo = prod.pedida === 0;
                    return (
                      <tr key={prod.productoId} className="border-b-2 border-gray-200 last:border-0">
                        <td className="px-4 py-2 text-gray-900">
                          {prod.nombre}
                          {esNuevo && (
                            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                              Nuevo
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-600">{prod.pedida}</td>
                        <td className="px-4 py-2 text-gray-600">{prod.vendida}</td>
                        <td
                          className={`px-4 py-2 font-medium ${diferencia < 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          {diferencia > 0 ? `+${diferencia}` : diferencia}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {pedidosConDiferencias.length === 0 && (
            <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
              No hay diferencias entre pedidos y ventas en este rango.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

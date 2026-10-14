import Link from "next/link";
import { formatFecha } from "@/lib/fecha";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { chunk } from "@/lib/chunk";
import CobranzaForm from "@/components/CobranzaForm";
import { UMBRAL_AVISO_BYTES, UMBRAL_BLOQUEO_BYTES } from "@/lib/cobranza-adjuntos";
import { createCobranza, registrarAnticipoPedido } from "../actions";

export default async function NuevaCobranzaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; venta_id?: string; pedido_id?: string; volver?: string }>;
}) {
  const { error, venta_id: ventaId, pedido_id: pedidoId, volver } = await searchParams;
  const supabase = await createClient();

  if (!ventaId && !pedidoId) {
    const [{ data: ventas }, { data: pedidosRaw }] = await Promise.all([
      supabase
        .from("ventas")
        .select("id, fecha, total, descuento, moneda, clientes(nombre)")
        .neq("estado", "anulada")
        .order("fecha", { ascending: false }),
      supabase
        .from("pedidos")
        .select("id, fecha, clientes(nombre), ventas(id), pedido_detalle(cantidad, precio_unitario)")
        .neq("estado", "cancelado")
        .order("fecha", { ascending: false }),
    ]);

    const ventaIds = (ventas ?? []).map((v) => v.id);
    // Estas listas no tienen filtro de fecha (traen TODAS las ventas/
    // pedidos de la empresa) — con .in() de una sola vez se vuelve una URL
    // demasiado larga pasadas unas pocas centenas y la consulta vuelve
    // vacía en silencio. Se divide en bloques.
    const cobranzas = (
      await Promise.all(
        chunk(ventaIds, 150).map((ids) =>
          supabase.from("cobranzas").select("venta_id, monto").eq("estado", "activa").in("venta_id", ids),
        ),
      )
    ).flatMap((r) => r.data ?? []);

    const cobradoPorVenta = new Map<string, number>();
    for (const c of cobranzas ?? []) {
      if (!c.venta_id) continue;
      cobradoPorVenta.set(c.venta_id, (cobradoPorVenta.get(c.venta_id) ?? 0) + c.monto);
    }

    const filasVentas = (ventas ?? [])
      .map((v) => {
        const cliente = v.clientes as unknown as { nombre: string } | null;
        const total = v.total - v.descuento;
        const cobrado = cobradoPorVenta.get(v.id) ?? 0;
        const saldo = Math.round((total - cobrado) * 100) / 100;
        return {
          id: v.id,
          fecha: v.fecha,
          clienteNombre: cliente?.nombre ?? "—",
          moneda: v.moneda,
          saldo,
        };
      })
      .filter((f) => f.saldo > 0.009);

    const filasPedidos = (pedidosRaw ?? [])
      .filter((p) => !(p.ventas as unknown as { id: string }[] | null)?.length)
      .map((p) => {
        const cliente = p.clientes as unknown as { nombre: string } | null;
        const detalle = p.pedido_detalle as unknown as { cantidad: number; precio_unitario: number }[];
        const totalEstimado = detalle.reduce((acc, d) => acc + d.cantidad * d.precio_unitario, 0);
        return {
          id: p.id,
          fecha: p.fecha,
          clienteNombre: cliente?.nombre ?? "—",
          totalEstimado: Math.round(totalEstimado * 100) / 100,
        };
      });

    return (
      <div className="p-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">
              Registrar cobro
            </h1>
            <Link
              href="/cobranzas"
              className="text-sm font-medium text-gray-600 hover:underline"
            >
              ← Volver al listado
            </Link>
          </div>

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Ventas pendientes de pago
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Selecciona la venta con saldo pendiente a la que corresponde el cobro.
          </p>
          <div className="mb-8 max-h-[40vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <ul>
              {filasVentas.map((f) => (
                <li key={f.id} className="border-b border-gray-100 last:border-0">
                  <Link
                    href={`/cobranzas/nueva?venta_id=${f.id}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">
                      {f.clienteNombre}
                    </span>
                    <span className="text-gray-500">{formatFecha(f.fecha)}</span>
                    <span className="font-medium text-red-600">
                      Debe {f.moneda} {f.saldo.toFixed(2)}
                    </span>
                  </Link>
                </li>
              ))}
              {filasVentas.length === 0 && (
                <li className="px-4 py-10 text-center text-gray-400">
                  No hay ventas con saldo pendiente.
                </li>
              )}
            </ul>
          </div>

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Pedidos sin venta
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Para un anticipo que el cliente paga antes de que exista la venta — al convertir el
            pedido en venta, este anticipo se suma solo al saldo.
          </p>
          <div className="max-h-[40vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <ul>
              {filasPedidos.map((f) => (
                <li key={f.id} className="border-b border-gray-100 last:border-0">
                  <Link
                    href={`/cobranzas/nueva?pedido_id=${f.id}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50"
                  >
                    <span className="font-medium text-gray-900">
                      {f.clienteNombre}
                    </span>
                    <span className="text-gray-500">{formatFecha(f.fecha)}</span>
                    <span className="font-medium text-gray-600">
                      Est. S/ {f.totalEstimado.toFixed(2)}
                    </span>
                  </Link>
                </li>
              ))}
              {filasPedidos.length === 0 && (
                <li className="px-4 py-10 text-center text-gray-400">
                  No hay pedidos pendientes sin venta.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const { data: bytesUsados } = await supabase.rpc("total_storage_usado_bytes");
  const almacenamientoBloqueado = (bytesUsados ?? 0) >= UMBRAL_BLOQUEO_BYTES;
  const almacenamientoAviso = (bytesUsados ?? 0) >= UMBRAL_AVISO_BYTES;

  if (pedidoId) {
    const [{ data: pedido }, { data: anticiposPrevios }] = await Promise.all([
      supabase
        .from("pedidos")
        .select("id, clientes(nombre), pedido_detalle(cantidad, precio_unitario)")
        .eq("id", pedidoId)
        .maybeSingle(),
      supabase.from("cobranzas").select("monto").eq("pedido_id", pedidoId).eq("estado", "activa"),
    ]);

    if (!pedido) notFound();

    const cliente = pedido.clientes as unknown as { nombre: string } | null;
    const detalle = pedido.pedido_detalle as unknown as { cantidad: number; precio_unitario: number }[];
    const totalEstimado = Math.round(detalle.reduce((acc, d) => acc + d.cantidad * d.precio_unitario, 0) * 100) / 100;
    const anticipado = Math.round((anticiposPrevios ?? []).reduce((acc, c) => acc + c.monto, 0) * 100) / 100;

    return (
      <div className="p-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">Registrar anticipo</h1>
            <Link
              href={volver || `/pedidos/${pedidoId}`}
              className="text-sm font-medium text-gray-600 hover:underline"
            >
              ← Volver
            </Link>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
            <CobranzaForm
              action={registrarAnticipoPedido}
              error={error}
              pedidoId={pedidoId}
              clienteNombre={cliente?.nombre ?? "—"}
              monedaSugerida="PEN"
              saldoPendiente={null}
              referenciaTexto={`Total estimado del pedido: S/ ${totalEstimado.toFixed(2)}${
                anticipado > 0 ? ` — ya adelantado: S/ ${anticipado.toFixed(2)}` : ""
              }`}
              redirectTo={volver}
              almacenamientoBloqueado={almacenamientoBloqueado}
              almacenamientoAviso={almacenamientoAviso}
            />
          </div>
        </div>
      </div>
    );
  }

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, total, descuento, moneda, clientes(nombre)")
    .eq("id", ventaId)
    .single();

  if (!venta) notFound();

  const { data: cobranzasPrevias } = await supabase
    .from("cobranzas")
    .select("monto")
    .eq("venta_id", ventaId)
    .eq("estado", "activa");

  const totalReferencia = venta.total - venta.descuento;
  const monedaReferencia = venta.moneda;
  const cobrado = (cobranzasPrevias ?? []).reduce((acc, c) => acc + c.monto, 0);
  const saldoPendiente = totalReferencia - cobrado;

  const cliente = venta.clientes as unknown as { nombre: string } | null;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Registrar cobro
          </h1>
          <Link
            href={volver || `/ventas/${ventaId}`}
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver
          </Link>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <CobranzaForm
            action={createCobranza}
            error={error}
            ventaId={ventaId}
            clienteNombre={cliente?.nombre ?? "—"}
            monedaSugerida={monedaReferencia}
            saldoPendiente={saldoPendiente}
            redirectTo={volver}
            almacenamientoBloqueado={almacenamientoBloqueado}
            almacenamientoAviso={almacenamientoAviso}
          />
        </div>
      </div>
    </div>
  );
}

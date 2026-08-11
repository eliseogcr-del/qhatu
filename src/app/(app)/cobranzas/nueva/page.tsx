import Link from "next/link";
import { formatFecha } from "@/lib/fecha";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CobranzaForm from "@/components/CobranzaForm";
import { UMBRAL_AVISO_BYTES, UMBRAL_BLOQUEO_BYTES } from "@/lib/cobranza-adjuntos";
import { createCobranza } from "../actions";

export default async function NuevaCobranzaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; pedido_id?: string }>;
}) {
  const { error, pedido_id: pedidoId } = await searchParams;
  const supabase = await createClient();

  if (!pedidoId) {
    const { data: pedidos } = await supabase
      .from("pedidos")
      .select("id, fecha, total, moneda, clientes(nombre)")
      .not("estado", "in", "(cancelado)")
      .order("fecha", { ascending: false });

    const pedidoIds = (pedidos ?? []).map((p) => p.id);
    const { data: ventas } =
      pedidoIds.length > 0
        ? await supabase
            .from("ventas")
            .select("id, pedido_id, total, moneda")
            .in("pedido_id", pedidoIds)
        : { data: [] as { id: string; pedido_id: string; total: number; moneda: string }[] };

    const ventaIds = (ventas ?? []).map((v) => v.id);
    const { data: cobranzas } = await supabase
      .from("cobranzas")
      .select("pedido_id, venta_id, monto")
      .eq("estado", "activa")
      .or(
        [
          pedidoIds.length > 0 ? `pedido_id.in.(${pedidoIds.join(",")})` : null,
          ventaIds.length > 0 ? `venta_id.in.(${ventaIds.join(",")})` : null,
        ]
          .filter(Boolean)
          .join(","),
      );

    const ventaPorPedido = new Map((ventas ?? []).map((v) => [v.pedido_id, v]));

    const filas = (pedidos ?? [])
      .map((p) => {
        const cliente = p.clientes as unknown as { nombre: string } | null;
        const venta = ventaPorPedido.get(p.id);
        const total = venta ? venta.total : p.total;
        const moneda = venta ? venta.moneda : p.moneda;
        const cobrado = (cobranzas ?? [])
          .filter((c) => (venta ? c.venta_id === venta.id : c.pedido_id === p.id))
          .reduce((acc, c) => acc + c.monto, 0);
        const saldo = Math.round((total - cobrado) * 100) / 100;
        return {
          id: p.id,
          fecha: p.fecha,
          clienteNombre: cliente?.nombre ?? "—",
          moneda,
          saldo,
        };
      })
      .filter((f) => f.saldo > 0.009);

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
          <p className="mb-4 text-sm text-gray-600">
            Selecciona el pedido o venta con saldo pendiente al que
            corresponde el cobro.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <ul>
              {filas.map((f) => (
                <li key={f.id} className="border-b border-gray-100 last:border-0">
                  <Link
                    href={`/cobranzas/nueva?pedido_id=${f.id}`}
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
              {filas.length === 0 && (
                <li className="px-4 py-10 text-center text-gray-400">
                  No hay pedidos ni ventas con saldo pendiente.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, total, moneda, clientes(nombre)")
    .eq("id", pedidoId)
    .single();

  if (!pedido) notFound();

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, total, moneda")
    .eq("pedido_id", pedidoId)
    .maybeSingle();

  const { data: cobranzasPrevias } = await supabase
    .from("cobranzas")
    .select("monto")
    .eq(venta ? "venta_id" : "pedido_id", venta ? venta.id : pedidoId)
    .eq("estado", "activa");

  const totalReferencia = venta ? venta.total : pedido.total;
  const monedaReferencia = venta ? venta.moneda : pedido.moneda;
  const cobrado = (cobranzasPrevias ?? []).reduce((acc, c) => acc + c.monto, 0);
  const saldoPendiente = totalReferencia - cobrado;

  const cliente = pedido.clientes as unknown as { nombre: string } | null;

  const { data: bytesUsados } = await supabase.rpc("total_storage_usado_bytes");
  const almacenamientoBloqueado = (bytesUsados ?? 0) >= UMBRAL_BLOQUEO_BYTES;
  const almacenamientoAviso = (bytesUsados ?? 0) >= UMBRAL_AVISO_BYTES;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Registrar cobro
          </h1>
          <Link
            href={`/pedidos/${pedidoId}`}
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver al pedido
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <CobranzaForm
            action={createCobranza}
            error={error}
            pedidoId={pedidoId}
            clienteNombre={cliente?.nombre ?? "—"}
            monedaSugerida={monedaReferencia}
            saldoPendiente={saldoPendiente}
            almacenamientoBloqueado={almacenamientoBloqueado}
            almacenamientoAviso={almacenamientoAviso}
          />
        </div>
      </div>
    </div>
  );
}

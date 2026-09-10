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
  searchParams: Promise<{ error?: string; venta_id?: string; volver?: string }>;
}) {
  const { error, venta_id: ventaId, volver } = await searchParams;
  const supabase = await createClient();

  if (!ventaId) {
    // Solo las ventas generan un cobro pendiente real — un pedido que
    // todavía no se registró como venta no es una deuda del cliente, así
    // que este listado nunca muestra pedidos sueltos.
    const { data: ventas } = await supabase
      .from("ventas")
      .select("id, fecha, total, descuento, moneda, clientes(nombre)")
      .neq("estado", "anulada")
      .order("fecha", { ascending: false });

    const ventaIds = (ventas ?? []).map((v) => v.id);
    const { data: cobranzas } =
      ventaIds.length > 0
        ? await supabase
            .from("cobranzas")
            .select("venta_id, monto")
            .eq("estado", "activa")
            .in("venta_id", ventaIds)
        : { data: [] as { venta_id: string | null; monto: number }[] };

    const cobradoPorVenta = new Map<string, number>();
    for (const c of cobranzas ?? []) {
      if (!c.venta_id) continue;
      cobradoPorVenta.set(c.venta_id, (cobradoPorVenta.get(c.venta_id) ?? 0) + c.monto);
    }

    const filas = (ventas ?? [])
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
            Selecciona la venta con saldo pendiente a la que corresponde el
            cobro.
          </p>
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <ul>
              {filas.map((f) => (
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
              {filas.length === 0 && (
                <li className="px-4 py-10 text-center text-gray-400">
                  No hay ventas con saldo pendiente.
                </li>
              )}
            </ul>
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

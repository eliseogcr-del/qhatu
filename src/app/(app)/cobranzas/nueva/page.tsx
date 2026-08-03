import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import CobranzaForm from "@/components/CobranzaForm";
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
      .select("id, fecha, clientes(nombre)")
      .not("estado", "in", "(cancelado)")
      .order("fecha", { ascending: false });

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
            Selecciona el pedido al que corresponde el cobro.
          </p>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <ul>
              {pedidos?.map((p) => {
                const cliente = p.clientes as unknown as { nombre: string } | null;
                return (
                  <li key={p.id} className="border-b border-gray-100 last:border-0">
                    <Link
                      href={`/cobranzas/nueva?pedido_id=${p.id}`}
                      className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium text-gray-900">
                        {cliente?.nombre ?? "—"}
                      </span>
                      <span className="text-gray-500">
                        {new Date(p.fecha).toLocaleDateString("es-PE")}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {pedidos?.length === 0 && (
                <li className="px-4 py-10 text-center text-gray-400">
                  No hay pedidos disponibles.
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
    .eq(venta ? "venta_id" : "pedido_id", venta ? venta.id : pedidoId);

  const totalReferencia = venta ? venta.total : pedido.total;
  const monedaReferencia = venta ? venta.moneda : pedido.moneda;
  const cobrado = (cobranzasPrevias ?? []).reduce((acc, c) => acc + c.monto, 0);
  const saldoPendiente = totalReferencia - cobrado;

  const cliente = pedido.clientes as unknown as { nombre: string } | null;

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

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <CobranzaForm
            action={createCobranza}
            error={error}
            pedidoId={pedidoId}
            clienteNombre={cliente?.nombre ?? "—"}
            monedaSugerida={monedaReferencia}
            saldoPendiente={saldoPendiente}
          />
        </div>
      </div>
    </div>
  );
}

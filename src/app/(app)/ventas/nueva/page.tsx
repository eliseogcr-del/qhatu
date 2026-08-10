import Link from "next/link";
import { formatFecha } from "@/lib/fecha";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import VentaForm from "@/components/VentaForm";
import { createVenta } from "../actions";

export default async function NuevaVentaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; pedido_id?: string }>;
}) {
  const { error, pedido_id: pedidoId } = await searchParams;
  const supabase = await createClient();

  if (!pedidoId) {
    const { data: ventaPedidoIds } = await supabase
      .from("ventas")
      .select("pedido_id");
    const excludeIds = (ventaPedidoIds ?? []).map((v) => v.pedido_id);

    let pedidosQuery = supabase
      .from("pedidos")
      .select("id, fecha, clientes(nombre)")
      .not("estado", "in", "(cancelado)")
      .order("fecha", { ascending: false });

    if (excludeIds.length > 0) {
      pedidosQuery = pedidosQuery.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data: pedidos } = await pedidosQuery;

    return (
      <div className="p-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">
              Registrar venta
            </h1>
            <div className="flex items-center gap-4">
              <Link
                href="/ventas/directa"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                + Venta directa (sin pedido)
              </Link>
              <Link
                href="/ventas"
                className="text-sm font-medium text-gray-600 hover:underline"
              >
                ← Volver al listado
              </Link>
            </div>
          </div>
          <p className="mb-4 text-sm text-gray-600">
            O selecciona un pedido existente para registrar lo entregado.
          </p>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <ul>
              {pedidos?.map((p) => {
                const cliente = p.clientes as unknown as { nombre: string } | null;
                return (
                  <li key={p.id} className="border-b border-gray-100 last:border-0">
                    <Link
                      href={`/ventas/nueva?pedido_id=${p.id}`}
                      className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50"
                    >
                      <span className="font-medium text-gray-900">
                        {cliente?.nombre ?? "—"}
                      </span>
                      <span className="text-gray-500">
                        {formatFecha(p.fecha)}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {pedidos?.length === 0 && (
                <li className="px-4 py-10 text-center text-gray-400">
                  No hay pedidos pendientes de venta.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const { data: existingVenta } = await supabase
    .from("ventas")
    .select("id")
    .eq("pedido_id", pedidoId)
    .maybeSingle();

  if (existingVenta) redirect(`/ventas/${existingVenta.id}`);

  const [{ data: pedido }, { data: detalle }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id, moneda, clientes(nombre)")
      .eq("id", pedidoId)
      .single(),
    supabase
      .from("pedido_detalle")
      .select("id, cantidad, precio_unitario, productos(nombre)")
      .eq("pedido_id", pedidoId),
  ]);

  if (!pedido) redirect("/ventas/nueva");

  const cliente = pedido.clientes as unknown as { nombre: string } | null;
  const lineasPedido = (detalle ?? []).map((d) => ({
    pedido_detalle_id: d.id,
    producto_nombre:
      (d.productos as unknown as { nombre: string } | null)?.nombre ?? "—",
    cantidad_pedida: d.cantidad,
    precio_unitario: d.precio_unitario,
  }));

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Registrar venta
          </h1>
          <Link
            href="/ventas"
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <VentaForm
            action={createVenta}
            error={error}
            pedidoId={pedido.id}
            clienteNombre={cliente?.nombre ?? "—"}
            monedaPedido={pedido.moneda}
            lineasPedido={lineasPedido}
          />
        </div>
      </div>
    </div>
  );
}

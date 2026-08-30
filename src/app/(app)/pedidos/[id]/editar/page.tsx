import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import PedidoForm from "@/components/PedidoForm";
import { updatePedido } from "../../actions";

export default async function EditarPedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  const { data: pedido } = await supabase
    .from("pedidos")
    .select(
      "id, cliente_id, canal_pedido, fecha_entrega_requerida, moneda, estado, almacen_id, clientes(nombre)",
    )
    .eq("id", id)
    .single();

  if (!pedido) notFound();

  if (pedido.estado !== "pendiente_confirmacion") {
    redirect(
      `/pedidos/${id}?error=${encodeURIComponent(
        "Solo se puede editar un pedido mientras está pendiente de confirmación.",
      )}`,
    );
  }

  const [{ data: detalle }, { data: clientes }, { data: productos }, { data: inventario }, { data: unidadesMedida }] =
    await Promise.all([
      supabase
        .from("pedido_detalle")
        .select("producto_id, cantidad, precio_unitario, unidad_medida_id")
        .eq("pedido_id", id),
      supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("productos")
        .select(
          "id, nombre, precio_venta, precio_venta_moneda, control_inventario, unidad_medida_id",
        )
        .eq("activo", true)
        .order("nombre"),
      supabase.from("inventario").select("producto_id, almacen_id, stock_actual"),
      supabase
        .from("unidades_medida")
        .select("id, descripcion, cantidad")
        .eq("activo", true)
        .order("descripcion"),
    ]);

  const stockPorAlmacen = Object.fromEntries(
    (inventario ?? []).map((i) => [`${i.producto_id}::${i.almacen_id}`, i.stock_actual]),
  );

  const cliente = pedido.clientes as unknown as { nombre: string } | null;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Editar pedido de {cliente?.nombre ?? "—"}
          </h1>
          <Link
            href={`/pedidos/${id}`}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al pedido
          </Link>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <PedidoForm
            modo="editar"
            action={updatePedido.bind(null, id)}
            error={error}
            clientes={clientes ?? []}
            productos={productos ?? []}
            unidadesMedida={unidadesMedida ?? []}
            stockPorAlmacen={stockPorAlmacen}
            pedidoInicial={{
              cliente_id: pedido.cliente_id,
              canal_pedido: pedido.canal_pedido,
              fecha_entrega_requerida: pedido.fecha_entrega_requerida,
              moneda: pedido.moneda,
              almacen_id: pedido.almacen_id,
              lineas: (detalle ?? []).map((d) => ({
                producto_id: d.producto_id,
                cantidad: d.cantidad,
                precio_unitario: d.precio_unitario,
                unidad_medida_id: d.unidad_medida_id ?? "",
              })),
            }}
          />
        </div>
      </div>
    </div>
  );
}

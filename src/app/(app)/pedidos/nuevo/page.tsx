import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import PedidoForm from "@/components/PedidoForm";
import { createPedido } from "../actions";

export default async function NuevoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { empresaId, almacenId } = await getEmpresaSession(supabase);
  const [
    { data: clientes },
    { data: productos },
    { data: almacenes },
    { data: inventario },
    { data: unidadesMedida },
  ] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("productos")
        .select(
          "id, nombre, precio_venta, precio_venta_moneda, control_inventario, unidad_medida_id",
        )
        .eq("activo", true)
        .order("nombre"),
      almacenId
        ? Promise.resolve({ data: null })
        : supabase
            .from("almacenes")
            .select("id, nombre")
            .eq("empresa_id", empresaId)
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

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Nuevo pedido
          </h1>
          <Link
            href="/pedidos"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <PedidoForm
            action={createPedido}
            error={error}
            clientes={clientes ?? []}
            productos={productos ?? []}
            unidadesMedida={unidadesMedida ?? []}
            almacenes={almacenes ?? undefined}
            stockPorAlmacen={stockPorAlmacen}
            almacenSesion={almacenId}
          />
        </div>
      </div>
    </div>
  );
}

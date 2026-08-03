import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import PedidoForm from "@/components/PedidoForm";
import { createPedido } from "../actions";

export default async function NuevoPedidoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const [{ data: clientes }, { data: productos }] = await Promise.all([
    supabase
      .from("clientes")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("productos")
      .select("id, nombre, precio_venta, precio_venta_moneda")
      .eq("activo", true)
      .order("nombre"),
  ]);

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

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <PedidoForm
            action={createPedido}
            error={error}
            clientes={clientes ?? []}
            productos={productos ?? []}
          />
        </div>
      </div>
    </div>
  );
}

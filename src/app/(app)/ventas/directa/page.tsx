import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import VentaDirectaForm from "@/components/VentaDirectaForm";
import { createVentaDirecta } from "../actions";

export default async function VentaDirectaPage({
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
            Venta directa
          </h1>
          <Link
            href="/ventas"
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Para ventas sin pedido previo (el cliente compra y se lleva el
          producto en el momento).
        </p>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <VentaDirectaForm
            action={createVentaDirecta}
            error={error}
            clientes={clientes ?? []}
            productos={productos ?? []}
          />
        </div>
      </div>
    </div>
  );
}

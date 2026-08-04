import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getSaldoVenta } from "@/utils/supabase/ventas";
import EditarVentaForm from "@/components/EditarVentaForm";
import { updateVentaDetalle } from "../actions";

export default async function EditarVentaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, total, moneda, estado, clientes(nombre)")
    .eq("id", id)
    .single();

  if (!venta) notFound();

  if (venta.estado === "anulada") {
    redirect(
      `/ventas/${id}?error=${encodeURIComponent("Esta venta está anulada y no se puede editar.")}`,
    );
  }

  const saldo = await getSaldoVenta(supabase, id, venta.total);
  if (saldo <= 0) {
    redirect(
      `/ventas/${id}?error=${encodeURIComponent("No se puede editar una venta que ya está completamente pagada.")}`,
    );
  }

  const cobrado = Math.round((venta.total - saldo) * 100) / 100;

  const [{ data: detalle }, { data: productos }] = await Promise.all([
    supabase
      .from("venta_detalle")
      .select("id, producto_id, cantidad_entregada, precio_unitario, productos(nombre)")
      .eq("venta_id", id),
    supabase
      .from("productos")
      .select("id, nombre, precio_venta")
      .eq("activo", true)
      .order("nombre"),
  ]);

  const lineasIniciales = (detalle ?? []).map((d) => ({
    id: d.id,
    producto_id: d.producto_id,
    producto_nombre:
      (d.productos as unknown as { nombre: string } | null)?.nombre ?? "—",
    cantidad_entregada: d.cantidad_entregada,
    precio_unitario: d.precio_unitario,
  }));

  const cliente = venta.clientes as unknown as { nombre: string } | null;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Editar venta de {cliente?.nombre ?? "—"}
          </h1>
          <Link
            href={`/ventas/${id}`}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver a la venta
          </Link>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          Puedes agregar, quitar o modificar productos. Cada cambio queda
          registrado en el log de auditoría.
        </p>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <EditarVentaForm
            action={updateVentaDetalle.bind(null, id)}
            error={error}
            ventaId={id}
            lineasIniciales={lineasIniciales}
            productos={productos ?? []}
            cobrado={cobrado}
            moneda={venta.moneda}
          />
        </div>
      </div>
    </div>
  );
}

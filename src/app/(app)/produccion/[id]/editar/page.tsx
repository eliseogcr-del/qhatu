import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireLogisticaOAdmin } from "@/utils/supabase/session";
import EditarProduccionForm from "@/components/EditarProduccionForm";
import { updateProduccionDetalle } from "../../actions";

export default async function EditarProduccionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  await requireLogisticaOAdmin(supabase);

  const [{ data: produccion }, { data: productos }] = await Promise.all([
    supabase
      .from("producciones")
      .select(
        "id, fecha, nota, almacenes(nombre), produccion_detalle(id, producto_id, cantidad, productos(nombre))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("productos")
      .select("id, nombre")
      .eq("activo", true)
      .eq("control_inventario", true)
      .order("nombre"),
  ]);

  if (!produccion) notFound();

  const almacen = produccion.almacenes as unknown as { nombre: string } | null;
  const lineas = produccion.produccion_detalle as unknown as {
    id: string;
    producto_id: string;
    cantidad: number;
    productos: { nombre: string } | null;
  }[];

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Editar producción</h1>
          <Link
            href="/produccion"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <EditarProduccionForm
            action={updateProduccionDetalle}
            error={error}
            produccionId={produccion.id}
            almacenNombre={almacen?.nombre ?? "—"}
            lineasIniciales={lineas.map((l) => ({
              id: l.id,
              producto_id: l.producto_id,
              producto_nombre: l.productos?.nombre ?? "—",
              cantidad: l.cantidad,
            }))}
            productos={productos ?? []}
          />
        </div>
      </div>
    </div>
  );
}

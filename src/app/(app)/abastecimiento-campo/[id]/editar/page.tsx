import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import AbastecimientoCampoForm from "@/components/AbastecimientoCampoForm";
import { updateAbastecimientoCampo } from "../../actions";

export default async function EditarAbastecimientoCampoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: abastecimiento }, { data: detalle }, { data: productos }, { data: unidadesMedida }] =
    await Promise.all([
      supabase
        .from("abastecimientos_campo")
        .select("id, nota, almacenes(nombre), proveedores(nombre)")
        .eq("id", id)
        .single(),
      supabase
        .from("abastecimiento_campo_detalle")
        .select("producto_id, cantidad, unidad_medida_id")
        .eq("abastecimiento_id", id),
      supabase
        .from("productos")
        .select("id, nombre, unidad_medida_id")
        .eq("activo", true)
        .eq("control_inventario", true)
        .order("nombre"),
      supabase
        .from("unidades_medida")
        .select("id, descripcion, cantidad")
        .eq("activo", true)
        .order("descripcion"),
    ]);

  if (!abastecimiento) notFound();

  const { data: compraVinculada } = await supabase
    .from("compras")
    .select("validado")
    .eq("abastecimiento_id", id)
    .maybeSingle();

  const almacen = abastecimiento.almacenes as unknown as { nombre: string } | null;
  const proveedor = abastecimiento.proveedores as unknown as { nombre: string } | null;
  const bloqueada = compraVinculada?.validado === true;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Editar abastecimiento en campo</h1>
          <Link
            href="/abastecimiento-campo"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        {bloqueada ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Este abastecimiento ya no se puede editar: la compra que generó ya fue
            validada por Admin/Logística.
          </p>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
            <AbastecimientoCampoForm
              action={updateAbastecimientoCampo.bind(null, id)}
              error={error}
              proveedores={[]}
              productos={productos ?? []}
              unidadesMedida={unidadesMedida ?? []}
              submitLabel="Guardar cambios"
              submitPendingLabel="Guardando..."
              initialValues={{
                proveedorNombre: proveedor?.nombre ?? null,
                almacenNombre: almacen?.nombre ?? "—",
                nota: abastecimiento.nota,
                lineas: (detalle ?? []).map((l) => ({
                  producto_id: l.producto_id,
                  cantidad: l.cantidad,
                  unidad_medida_id: l.unidad_medida_id ?? "",
                })),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

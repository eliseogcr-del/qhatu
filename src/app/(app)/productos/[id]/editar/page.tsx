import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ProductoForm from "@/components/ProductoForm";
import { updateProducto } from "../../actions";

export default async function EditarProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const [{ data: producto }, { data: proveedores }] = await Promise.all([
    supabase.from("productos").select("*").eq("id", id).single(),
    supabase
      .from("proveedores")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
  ]);

  if (!producto) notFound();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Editar producto
          </h1>
          <Link
            href="/productos"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <ProductoForm
            action={updateProducto.bind(null, id)}
            initialValues={producto}
            error={error}
            submitLabel="Guardar cambios"
            proveedores={proveedores ?? []}
          />
        </div>
      </div>
    </div>
  );
}

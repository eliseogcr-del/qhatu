import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import ProveedorForm from "@/components/ProveedorForm";
import { updateProveedor } from "../../actions";

export default async function EditarProveedorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: proveedor } = await supabase
    .from("proveedores")
    .select("*")
    .eq("id", id)
    .single();

  if (!proveedor) notFound();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Editar proveedor
          </h1>
          <Link
            href="/proveedores"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <ProveedorForm
            action={updateProveedor.bind(null, id)}
            initialValues={proveedor}
            error={error}
            submitLabel="Guardar cambios"
          />
        </div>
      </div>
    </div>
  );
}

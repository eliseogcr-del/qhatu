import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import ProductoForm from "@/components/ProductoForm";
import { createProducto } from "../actions";

export default async function NuevoProductoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; q?: string }>;
}) {
  const { error, q } = await searchParams;

  const supabase = await createClient();
  const [{ data: proveedores }, { data: unidadesMedida }] = await Promise.all([
    supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
    supabase
      .from("unidades_medida")
      .select("id, descripcion")
      .eq("activo", true)
      .order("descripcion"),
  ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Nuevo producto
          </h1>
          <Link
            href={`/productos${q ? `?q=${encodeURIComponent(q)}` : ""}`}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <ProductoForm
            action={createProducto}
            error={error}
            submitLabel="Crear producto"
            proveedores={proveedores ?? []}
            unidadesMedida={unidadesMedida ?? []}
            q={q}
          />
        </div>
      </div>
    </div>
  );
}

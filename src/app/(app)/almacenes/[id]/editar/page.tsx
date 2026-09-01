import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import SubmitButton from "@/components/SubmitButton";
import { updateAlmacen } from "../../actions";

export default async function EditarAlmacenPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { data: almacen } = await supabase
    .from("almacenes")
    .select("id, nombre, direccion")
    .eq("id", id)
    .single();

  if (!almacen) notFound();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Editar almacén
          </h1>
          <Link
            href="/almacenes"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <form
            action={updateAlmacen.bind(null, id)}
            className="grid grid-cols-1 gap-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Nombre
              </label>
              <input
                name="nombre"
                required
                defaultValue={almacen.nombre}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Dirección (opcional)
              </label>
              <input
                name="direccion"
                defaultValue={almacen.direccion ?? ""}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <SubmitButton>Guardar cambios</SubmitButton>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import TrasladoForm from "@/components/TrasladoForm";
import { createTraslado } from "../actions";

export default async function NuevoTrasladoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);

  const [{ data: almacenes }, { data: productos }] = await Promise.all([
    supabase.from("almacenes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase
      .from("productos")
      .select("id, nombre")
      .eq("activo", true)
      .eq("control_inventario", true)
      .order("nombre"),
  ]);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Nuevo traslado</h1>
          <Link
            href="/traslados"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Mueve mercadería entre almacenes (ej. la carga inicial de un
          vendedor antes de salir a ruta, o el retorno de lo no vendido). Los
          dos lados del movimiento se registran juntos, siempre cuadrados.
        </p>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <TrasladoForm
            action={createTraslado}
            error={error}
            almacenes={almacenes ?? []}
            productos={productos ?? []}
            almacenSesion={session.rol === "admin" ? null : session.almacenId}
          />
        </div>
      </div>
    </div>
  );
}

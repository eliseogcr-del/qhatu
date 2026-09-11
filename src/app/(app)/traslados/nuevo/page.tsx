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

  const [{ data: almacenes }, { data: productos }, { data: inventario }, { data: usuariosVendedores }] =
    await Promise.all([
      supabase
        .from("almacenes")
        .select("id, nombre, es_digital")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("productos")
        .select("id, nombre")
        .eq("activo", true)
        .eq("control_inventario", true)
        .order("nombre"),
      supabase.from("inventario").select("producto_id, almacen_id, stock_actual"),
      supabase.from("usuarios").select("almacen_id").eq("rol", "vendedor").not("almacen_id", "is", null),
    ]);

  const stockPorAlmacen = Object.fromEntries(
    (inventario ?? []).map((i) => [`${i.producto_id}::${i.almacen_id}`, i.stock_actual]),
  );

  // Almacenes "móvil" (asignados a un vendedor) o digitales: al elegirlos
  // como origen de un traslado se precarga todo su stock disponible, para
  // no tener que agregar producto por producto al devolver/reubicar la
  // carga completa hacia el almacén principal.
  const almacenesMovilOdigital = new Set([
    ...(usuariosVendedores ?? []).map((u) => u.almacen_id as string),
    ...(almacenes ?? []).filter((a) => a.es_digital).map((a) => a.id),
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

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <TrasladoForm
            action={createTraslado}
            error={error}
            almacenes={almacenes ?? []}
            productos={productos ?? []}
            almacenSesion={session.rol === "admin" ? null : session.almacenId}
            stockPorAlmacen={stockPorAlmacen}
            almacenesMovilODigital={[...almacenesMovilOdigital]}
          />
        </div>
      </div>
    </div>
  );
}

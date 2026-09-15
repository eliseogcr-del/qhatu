import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { preciosBloqueados as obtenerPreciosBloqueados } from "@/utils/supabase/precios";
import VentaRapidaForm from "@/components/VentaRapidaForm";
import { createVentaRapida } from "../actions";

// Pantalla dedicada para el vendedor de almacén móvil, que vende parado en
// la calle desde su celular — es un módulo aparte de "Venta directa"
// (usada por admin/logística y el almacén digital), no una variante de
// esa pantalla: menos campos, letra grande, cliente frecuente por
// defecto, y al guardar se queda acá lista para la siguiente venta.
export default async function VentaRapidaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { error, guardado } = await searchParams;

  const supabase = await createClient();
  const { empresaId, almacenId } = await getEmpresaSession(supabase);

  const [{ data: clientes }, { data: productos }, { data: inventario }, { data: unidadesMedida }, preciosBloqueados] =
    await Promise.all([
      supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("productos")
        .select("id, nombre, control_inventario, unidad_medida_id, unidad_venta_defecto_id, precio_editable")
        .eq("activo", true)
        .order("nombre"),
      supabase.from("inventario").select("producto_id, almacen_id, stock_actual"),
      supabase
        .from("unidades_medida")
        .select("id, descripcion, cantidad")
        .eq("activo", true)
        .order("descripcion"),
      obtenerPreciosBloqueados(supabase, empresaId),
    ]);

  const stockPorAlmacen = Object.fromEntries(
    (inventario ?? []).map((i) => [`${i.producto_id}::${i.almacen_id}`, i.stock_actual]),
  );

  // Cliente genérico para las ventas al paso en la calle (la mayoría no
  // son clientes con ficha propia) — si existe, se preselecciona para no
  // obligarla a buscarlo en cada venta; si es un cliente real, lo cambia
  // en el mismo buscador.
  const clienteFrecuenteId =
    (clientes ?? []).find((c) => c.nombre.trim().toLowerCase() === "cliente frecuente")?.id ??
    null;

  return (
    <div className="p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Venta rápida</h1>
          <Link href="/dashboard" className="text-sm font-medium text-gray-600 hover:underline">
            ← Panel
          </Link>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-6">
          <VentaRapidaForm
            action={createVentaRapida}
            error={error}
            guardado={guardado === "1"}
            clientes={clientes ?? []}
            clienteFrecuenteId={clienteFrecuenteId}
            productos={productos ?? []}
            unidadesMedida={unidadesMedida ?? []}
            stockPorAlmacen={stockPorAlmacen}
            almacenSesion={almacenId}
            preciosBloqueados={preciosBloqueados}
          />
        </div>
      </div>
    </div>
  );
}

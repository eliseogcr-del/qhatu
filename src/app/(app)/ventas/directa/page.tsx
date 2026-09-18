import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import {
  preciosBloqueados as obtenerPreciosBloqueados,
  descuentoHabilitado as obtenerDescuentoHabilitado,
} from "@/utils/supabase/precios";
import { filtrarPromocionesVigentes } from "@/utils/promociones";
import VentaDirectaForm from "@/components/VentaDirectaForm";
import { createVentaDirecta } from "../actions";

export default async function VentaDirectaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const { empresaId, almacenId } = await getEmpresaSession(supabase);
  const [
    { data: clientes },
    { data: productos },
    { data: almacenes },
    { data: inventario },
    { data: unidadesMedida },
    preciosBloqueados,
    descuentoHabilitado,
  ] = await Promise.all([
      supabase
        .from("clientes")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("productos")
        .select(
          "id, nombre, control_inventario, unidad_medida_id, unidad_venta_defecto_id, precio_editable, es_promocion, promocion_de_producto_id, promocion_cantidad_minima, promocion_inicio, promocion_fin",
        )
        // Productos normales activos, más promociones activas (activo
        // siempre queda en false para las promociones, ver 20260918010000).
        // La vigencia por fecha (promocion_inicio/fin) se filtra abajo,
        // porque combinarla con el OR de arriba en una sola consulta
        // PostgREST es poco confiable.
        .or("activo.eq.true,and(es_promocion.eq.true,promocion_activa.eq.true)")
        .order("nombre"),
      almacenId
        ? Promise.resolve({ data: null })
        : supabase
            .from("almacenes")
            .select("id, nombre")
            .eq("empresa_id", empresaId)
            .eq("activo", true)
            .order("nombre"),
      supabase.from("inventario").select("producto_id, almacen_id, stock_actual"),
      supabase
        .from("unidades_medida")
        .select("id, descripcion, cantidad")
        .eq("activo", true)
        .order("descripcion"),
      obtenerPreciosBloqueados(supabase, empresaId),
      obtenerDescuentoHabilitado(supabase, empresaId),
    ]);

  const stockPorAlmacen = Object.fromEntries(
    (inventario ?? []).map((i) => [`${i.producto_id}::${i.almacen_id}`, i.stock_actual]),
  );

  const productosVigentes = filtrarPromocionesVigentes(productos ?? []);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Venta directa
          </h1>
          <Link
            href="/ventas"
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          Para ventas sin pedido previo (el cliente compra y se lleva el
          producto en el momento).
        </p>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <VentaDirectaForm
            action={createVentaDirecta}
            error={error}
            clientes={clientes ?? []}
            productos={productosVigentes}
            unidadesMedida={unidadesMedida ?? []}
            almacenes={almacenes ?? undefined}
            stockPorAlmacen={stockPorAlmacen}
            almacenSesion={almacenId}
            preciosBloqueados={preciosBloqueados}
            descuentoHabilitado={descuentoHabilitado}
          />
        </div>
      </div>
    </div>
  );
}

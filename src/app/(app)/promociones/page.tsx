import { Tag, Save } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireLogisticaOAdmin } from "@/utils/supabase/session";
import SubmitButton from "@/components/SubmitButton";
import ProductoCombobox from "@/components/ProductoCombobox";
import PromocionRow from "@/components/PromocionRow";
import { crearPromocion, actualizarPromocion, alternarPromocionActiva } from "./actions";

export default async function PromocionesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { error, guardado } = await searchParams;
  const supabase = await createClient();
  const { empresaId } = await requireLogisticaOAdmin(supabase);

  const [{ data: productos }, { data: promociones }] = await Promise.all([
    supabase
      .from("productos")
      .select("id, nombre")
      .eq("empresa_id", empresaId)
      .eq("activo", true)
      .eq("es_promocion", false)
      .order("nombre"),
    supabase
      .from("productos")
      .select(
        "id, nombre, promocion_activa, promocion_de_producto_id, promocion_cantidad_minima, promocion_cantidad_regalo, promocion_precio, promocion_inicio, promocion_fin",
      )
      .eq("empresa_id", empresaId)
      .eq("es_promocion", true)
      .order("created_at", { ascending: false }),
  ]);

  const nombreProducto = new Map((productos ?? []).map((p) => [p.id, p.nombre]));

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center gap-3">
          <Tag size={24} className="text-emerald-700" />
          <h1 className="text-2xl font-semibold text-gray-900">Promociones</h1>
        </div>
        <p className="-mt-6 text-sm text-gray-500">
          Al vender al menos la cantidad mínima del producto atado, la
          promoción se agrega sola a la venta con la cantidad a regalar que
          corresponda al precio unitario configurado (ej. &quot;lleva 12 y
          la 13 gratis&quot; = cantidad mínima 12, cantidad a regalar 1,
          precio 0; con 24 se agregan 2). También sirve para descuentos como
          &quot;paga la mitad&quot;, con un precio mayor a 0 pero menor al
          normal. Además de estar activa, si defines inicio y/o fin de
          campaña solo se aplica dentro de ese rango de fecha y hora.
        </p>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {guardado && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Configuración guardada.
          </p>
        )}

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Nueva promoción
          </h2>
          <form
            action={crearPromocion}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
              <input
                name="nombre"
                required
                placeholder="Ej. Promo Empanada de Pollo"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Producto atado
              </label>
              <ProductoCombobox
                productos={productos ?? []}
                name="promocion_de_producto_id"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cantidad mínima
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="cantidad_minima"
                required
                defaultValue={1}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cantidad a regalar
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="cantidad_regalo"
                required
                defaultValue={1}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Precio</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="precio"
                required
                defaultValue={0}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="promocion_activa"
                  defaultChecked
                  className="h-4 w-4 rounded border-gray-300"
                />
                Activa (visible para cualquier almacén al registrar una venta)
              </label>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Inicio de campaña (opcional)
              </label>
              <input
                type="datetime-local"
                name="promocion_inicio"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Fin de campaña (opcional)
              </label>
              <input
                type="datetime-local"
                name="promocion_fin"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <SubmitButton icon={<Save size={16} />}>Guardar</SubmitButton>
            </div>
          </form>
          <p className="mt-2 text-xs text-gray-500">
            Se registra como una línea aparte en la venta, no como un
            descuento sobre el producto atado — el precio es por unidad
            (0 para gratis, o un monto menor para un descuento tipo &quot;paga
            la mitad&quot;).
          </p>
        </div>

        <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-bold">Nombre</th>
                <th className="px-4 py-3 font-bold">Producto atado</th>
                <th className="px-4 py-3 font-bold">Cantidad mínima</th>
                <th className="px-4 py-3 font-bold">Cantidad a regalar</th>
                <th className="px-4 py-3 font-bold">Precio</th>
                <th className="px-4 py-3 font-bold">Inicio</th>
                <th className="px-4 py-3 font-bold">Fin</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {promociones?.map((p) => (
                <PromocionRow
                  key={p.id}
                  nombre={p.nombre}
                  productoNombre={
                    (p.promocion_de_producto_id && nombreProducto.get(p.promocion_de_producto_id)) ??
                    "—"
                  }
                  cantidadMinima={p.promocion_cantidad_minima}
                  cantidadRegalo={p.promocion_cantidad_regalo}
                  precio={p.promocion_precio}
                  inicio={p.promocion_inicio}
                  fin={p.promocion_fin}
                  activa={p.promocion_activa}
                  onActualizar={actualizarPromocion.bind(null, p.id)}
                  onAlternarActiva={alternarPromocionActiva.bind(null, p.id)}
                />
              ))}
              {promociones?.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay promociones configuradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

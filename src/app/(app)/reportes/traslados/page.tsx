import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { inicioDiaLima, finDiaLima } from "@/lib/fecha";

type Fila = {
  almacenId: string;
  almacenNombre: string;
  productoId: string;
  productoNombre: string;
  cargado: number;
  recogidoEnCampo: number;
  compradoEnRuta: number;
  vendido: number;
  merma: number;
  trasladadoAfuera: number;
  stockActual: number;
};

export default async function ReporteTrasladosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; almacen_id?: string }>;
}) {
  const { desde, hasta, almacen_id: almacenIdParam } = await searchParams;
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);

  // Un vendedor tiene almacén fijo: siempre ve solo el suyo, sin importar
  // qué venga en la URL. Admin/logística (almacenId null) eligen libremente.
  const almacen_id = session.almacenId ?? almacenIdParam;

  let almacenesQuery = supabase
    .from("almacenes")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (session.almacenId) almacenesQuery = almacenesQuery.eq("id", session.almacenId);
  const { data: almacenes } = await almacenesQuery;

  let query = supabase
    .from("kardex_movimientos")
    .select(
      "almacen_id, producto_id, tipo_movimiento, cantidad, almacenes(nombre), productos(nombre)",
    )
    .in("tipo_movimiento", [
      "traslado_entrada",
      "traslado_salida",
      "venta",
      "compra",
      "abastecimiento_campo",
      "merma",
    ]);

  if (desde) query = query.gte("fecha", inicioDiaLima(desde));
  if (hasta) query = query.lte("fecha", finDiaLima(hasta));
  if (almacen_id) query = query.eq("almacen_id", almacen_id);

  const { data: movimientos, error } = await query;

  const mapa = new Map<string, Fila>();
  for (const m of movimientos ?? []) {
    const key = `${m.almacen_id}::${m.producto_id}`;
    const almacen = m.almacenes as unknown as { nombre: string } | null;
    const producto = m.productos as unknown as { nombre: string } | null;

    if (!mapa.has(key)) {
      mapa.set(key, {
        almacenId: m.almacen_id,
        almacenNombre: almacen?.nombre ?? "—",
        productoId: m.producto_id,
        productoNombre: producto?.nombre ?? "—",
        cargado: 0,
        recogidoEnCampo: 0,
        compradoEnRuta: 0,
        vendido: 0,
        merma: 0,
        trasladadoAfuera: 0,
        stockActual: 0,
      });
    }
    const fila = mapa.get(key)!;
    const cantidad = Math.abs(m.cantidad);
    if (m.tipo_movimiento === "traslado_entrada") fila.cargado += cantidad;
    else if (m.tipo_movimiento === "traslado_salida") fila.trasladadoAfuera += cantidad;
    else if (m.tipo_movimiento === "venta") fila.vendido += cantidad;
    else if (m.tipo_movimiento === "compra") fila.compradoEnRuta += cantidad;
    else if (m.tipo_movimiento === "abastecimiento_campo") fila.recogidoEnCampo += cantidad;
    else if (m.tipo_movimiento === "merma") fila.merma += cantidad;
  }

  const filas = [...mapa.values()];

  if (filas.length > 0) {
    const { data: inventarios } = await supabase
      .from("inventario")
      .select("almacen_id, producto_id, stock_actual")
      .in("almacen_id", [...new Set(filas.map((f) => f.almacenId))])
      .in("producto_id", [...new Set(filas.map((f) => f.productoId))]);

    const stockPorClave = new Map(
      (inventarios ?? []).map((i) => [`${i.almacen_id}::${i.producto_id}`, i.stock_actual]),
    );
    for (const fila of filas) {
      fila.stockActual = stockPorClave.get(`${fila.almacenId}::${fila.productoId}`) ?? 0;
    }
  }

  const almacenesConMovimiento = [...new Set(filas.map((f) => f.almacenId))].map((id) => ({
    id,
    nombre: filas.find((f) => f.almacenId === id)!.almacenNombre,
  }));

  const hayFiltros = !!(desde || hasta || (!session.almacenId && almacen_id));

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Cruce de mercadería por almacén
          </h1>
          <Link
            href="/reportes"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver a reportes
          </Link>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Pensado para el almacén móvil de un vendedor de campo: cuánto se le
          cargó, cuánto recogió de un proveedor en el camino (sin
          documento), cuánto compró en ruta (con documento), cuánto vendió,
          cuánta merma tuvo y cuánto trasladó de vuelta — para saber cuánto
          debería devolver. El &quot;stock actual&quot; es el de hoy, no
          necesariamente el del final del rango filtrado.
        </p>

        <form className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm" method="get">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Almacén</label>
            {session.almacenId ? (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {almacenes?.[0]?.nombre ?? "Tu almacén"}
              </p>
            ) : (
              <select
                name="almacen_id"
                defaultValue={almacen_id ?? ""}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {almacenes?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/reportes/traslados"
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Limpiar
            </Link>
          )}
        </form>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="space-y-6">
          {almacenesConMovimiento.map((a) => {
            const filasAlmacen = filas.filter((f) => f.almacenId === a.id);
            return (
              <div
                key={a.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="font-medium text-gray-900">{a.nombre}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
                      <tr>
                        <th className="px-4 py-2 font-bold">Producto</th>
                        <th className="px-4 py-2 font-bold">Cargado</th>
                        <th className="px-4 py-2 font-bold">Recogido en campo</th>
                        <th className="px-4 py-2 font-bold">Comprado en ruta</th>
                        <th className="px-4 py-2 font-bold">Vendido</th>
                        <th className="px-4 py-2 font-bold">Merma</th>
                        <th className="px-4 py-2 font-bold">Trasladado (salida)</th>
                        <th className="px-4 py-2 font-bold">Stock actual</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filasAlmacen.map((f) => (
                        <tr key={f.productoId} className="border-b-2 border-gray-200 last:border-0">
                          <td className="px-4 py-2 font-medium text-gray-900">
                            {f.productoNombre}
                          </td>
                          <td className="px-4 py-2 text-green-700">
                            {f.cargado > 0 ? `+${f.cargado}` : "—"}
                          </td>
                          <td className="px-4 py-2 text-green-700">
                            {f.recogidoEnCampo > 0 ? `+${f.recogidoEnCampo}` : "—"}
                          </td>
                          <td className="px-4 py-2 text-green-700">
                            {f.compradoEnRuta > 0 ? `+${f.compradoEnRuta}` : "—"}
                          </td>
                          <td className="px-4 py-2 text-red-600">
                            {f.vendido > 0 ? `-${f.vendido}` : "—"}
                          </td>
                          <td className="px-4 py-2 text-red-600">
                            {f.merma > 0 ? `-${f.merma}` : "—"}
                          </td>
                          <td className="px-4 py-2 text-red-600">
                            {f.trasladadoAfuera > 0 ? `-${f.trasladadoAfuera}` : "—"}
                          </td>
                          <td className="px-4 py-2 font-semibold text-gray-900">
                            {f.stockActual}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {almacenesConMovimiento.length === 0 && (
            <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
              No hay movimientos de traslado, venta, compra o merma en este rango.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

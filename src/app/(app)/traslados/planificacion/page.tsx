import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { hoyLima } from "@/lib/fecha";

type Fila = {
  productoId: string;
  productoNombre: string;
  totalPedido: number;
  stockOrigen: number;
  porAlmacen: Record<string, number>;
};

export default async function PlanificacionTrasladosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; almacen_origen_id?: string }>;
}) {
  const { fecha, almacen_origen_id: almacenOrigenIdParam } = await searchParams;
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);

  const fechaEfectiva = fecha || hoyLima();
  // El "almacén de origen" es de dónde se despacha la mercadería: si quien
  // ve el reporte es vendedor, siempre es el suyo (fijo, sin elegir); si es
  // admin/logística (sin almacén propio), lo elige con el selector.
  const origenId = session.almacenId ?? almacenOrigenIdParam ?? null;

  const [{ data: pedidoLineas }, { data: trasladoLineas }, { data: almacenes }, { data: stockOrigenRows }] =
    await Promise.all([
      supabase
        .from("pedido_detalle")
        .select("cantidad, producto_id, productos(nombre), pedidos!inner(fecha_entrega_requerida, estado)")
        .eq("pedidos.fecha_entrega_requerida", fechaEfectiva)
        .neq("pedidos.estado", "cancelado"),
      supabase
        .from("traslado_detalle")
        .select(
          "cantidad, producto_id, productos(nombre), traslados!inner(fecha, almacen_destino:almacen_destino_id(id, nombre))",
        )
        .gte("traslados.fecha", fechaEfectiva)
        .lte("traslados.fecha", `${fechaEfectiva}T23:59:59`),
      supabase.from("almacenes").select("id, nombre").eq("activo", true).order("nombre"),
      origenId
        ? supabase.from("inventario").select("producto_id, stock_actual").eq("almacen_id", origenId)
        : Promise.resolve({ data: null as { producto_id: string; stock_actual: number }[] | null }),
    ]);

  const nombreAlmacenOrigen = almacenes?.find((a) => a.id === origenId)?.nombre ?? null;
  const stockOrigenMap = new Map(
    (stockOrigenRows ?? []).map((r) => [r.producto_id, r.stock_actual]),
  );

  const filasMap = new Map<string, Fila>();
  const almacenesMap = new Map<string, string>();

  for (const l of pedidoLineas ?? []) {
    const producto = l.productos as unknown as { nombre: string } | null;
    const fila: Fila = filasMap.get(l.producto_id) ?? {
      productoId: l.producto_id,
      productoNombre: producto?.nombre ?? "—",
      totalPedido: 0,
      stockOrigen: stockOrigenMap.get(l.producto_id) ?? 0,
      porAlmacen: {},
    };
    fila.totalPedido += l.cantidad;
    filasMap.set(l.producto_id, fila);
  }

  for (const l of trasladoLineas ?? []) {
    const producto = l.productos as unknown as { nombre: string } | null;
    const almacen = (l.traslados as unknown as { almacen_destino: { id: string; nombre: string } | null })
      .almacen_destino;
    if (!almacen) continue;

    almacenesMap.set(almacen.id, almacen.nombre);

    const fila: Fila = filasMap.get(l.producto_id) ?? {
      productoId: l.producto_id,
      productoNombre: producto?.nombre ?? "—",
      totalPedido: 0,
      stockOrigen: stockOrigenMap.get(l.producto_id) ?? 0,
      porAlmacen: {},
    };
    fila.porAlmacen[almacen.id] = (fila.porAlmacen[almacen.id] ?? 0) + l.cantidad;
    filasMap.set(l.producto_id, fila);
  }

  const almacenesDestino = [...almacenesMap.entries()]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const filas = [...filasMap.values()].sort((a, b) =>
    a.productoNombre.localeCompare(b.productoNombre),
  );

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Planificación de traslados
          </h1>
          <Link
            href="/traslados"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver a traslados
          </Link>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Por cada producto, la cantidad total pedida para la fecha de
          entrega elegida (sumando todos los pedidos de ese día) y cuánto ya
          se ha trasladado a cada almacén en tránsito. Ayuda a decidir qué
          falta enviarle a cada vendedor.
        </p>

        <form className="mb-4 flex items-end gap-3" method="get">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Fecha de entrega
            </label>
            <input
              type="date"
              name="fecha"
              defaultValue={fechaEfectiva}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {session.almacenId ? (
            // Vendedor: su almacén es fijo, no hay nada que elegir.
            <input type="hidden" name="almacen_origen_id" value={session.almacenId} />
          ) : (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Almacén de origen
              </label>
              <select
                name="almacen_origen_id"
                defaultValue={origenId ?? ""}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Selecciona un almacén</option>
                {almacenes?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
        </form>

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Producto</th>
                <th className="px-4 py-3 font-bold">
                  Stock en {nombreAlmacenOrigen ?? "almacén de origen"}
                </th>
                <th className="px-4 py-3 font-bold">Cantidad pedida</th>
                {almacenesDestino.map((a) => (
                  <th key={a.id} className="px-4 py-3 font-bold">
                    {a.nombre}
                  </th>
                ))}
                <th className="px-4 py-3 font-bold">Total trasladado</th>
                <th className="px-4 py-3 font-bold">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const totalTrasladado = Object.values(f.porAlmacen).reduce(
                  (acc, n) => acc + n,
                  0,
                );
                const pendiente = Math.round((f.totalPedido - totalTrasladado) * 100) / 100;
                return (
                  <tr key={f.productoId} className="border-b-2 border-gray-200 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {f.productoNombre}
                    </td>
                    <td
                      className={`px-4 py-3 ${origenId && f.stockOrigen <= 0 ? "font-semibold text-red-600" : "text-gray-600"}`}
                    >
                      {origenId ? f.stockOrigen : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {f.totalPedido > 0 ? f.totalPedido : "—"}
                    </td>
                    {almacenesDestino.map((a) => (
                      <td key={a.id} className="px-4 py-3 text-gray-600">
                        {f.porAlmacen[a.id] ?? ""}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-gray-600">
                      {totalTrasladado > 0 ? totalTrasladado : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${pendiente > 0 ? "text-amber-600" : "text-green-600"}`}
                    >
                      {pendiente}
                    </td>
                  </tr>
                );
              })}
              {filas.length === 0 && (
                <tr>
                  <td
                    colSpan={5 + almacenesDestino.length}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    No hay pedidos ni traslados para esa fecha.
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

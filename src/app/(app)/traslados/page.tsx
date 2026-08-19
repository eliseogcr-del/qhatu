import Link from "next/link";
import { formatFechaHora, hoyLima } from "@/lib/fecha";
import { Plus, Search, X, ClipboardList } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function TrasladosPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    producto_id?: string;
    almacen_origen_id?: string;
    almacen_destino_id?: string;
  }>;
}) {
  const {
    desde,
    hasta,
    producto_id: productoId,
    almacen_origen_id: almacenOrigenId,
    almacen_destino_id: almacenDestinoId,
  } = await searchParams;
  const supabase = await createClient();

  // Sin parámetros en la URL (primera carga) se muestra el día de hoy por
  // defecto. Si el usuario borra los campos de fecha y filtra, quedan como
  // string vacío (presentes pero sin valor) y ahí sí se ve todo.
  const hoy = hoyLima();
  const desdeEfectivo = desde === undefined ? hoy : desde;
  const hastaEfectivo = hasta === undefined ? hoy : hasta;

  const [{ data: productos }, { data: almacenes }] = await Promise.all([
    supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("almacenes").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  let query = supabase
    .from("traslados")
    .select(
      "id, fecha, almacen_origen:almacen_origen_id(nombre), almacen_destino:almacen_destino_id(nombre), usuarios(nombre), traslado_detalle(id, cantidad, producto_id, productos(nombre))",
    )
    .order("fecha", { ascending: false })
    .limit(100);

  if (desdeEfectivo) query = query.gte("fecha", desdeEfectivo);
  if (hastaEfectivo) query = query.lte("fecha", `${hastaEfectivo}T23:59:59`);
  if (almacenOrigenId) query = query.eq("almacen_origen_id", almacenOrigenId);
  if (almacenDestinoId) query = query.eq("almacen_destino_id", almacenDestinoId);

  const { data: traslados, error } = await query;

  const hayFiltros = !!(
    desde !== undefined ||
    hasta !== undefined ||
    productoId ||
    almacenOrigenId ||
    almacenDestinoId
  );

  const filas = (traslados ?? []).flatMap((t) => {
    const origen = t.almacen_origen as unknown as { nombre: string } | null;
    const destino = t.almacen_destino as unknown as { nombre: string } | null;
    const usuario = t.usuarios as unknown as { nombre: string | null } | null;
    const lineas = t.traslado_detalle as unknown as {
      id: string;
      cantidad: number;
      producto_id: string;
      productos: { nombre: string } | null;
    }[];

    return lineas
      .filter((l) => !productoId || l.producto_id === productoId)
      .map((l) => ({
        id: l.id,
        fecha: t.fecha,
        origenNombre: origen?.nombre ?? "—",
        destinoNombre: destino?.nombre ?? "—",
        usuarioNombre: usuario?.nombre ?? "—",
        productoNombre: l.productos?.nombre ?? "—",
        cantidad: l.cantidad,
      }));
  });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Traslados</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/traslados/planificacion"
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ClipboardList size={16} />
              Planificación
            </Link>
            <Link
              href="/traslados/nuevo"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus size={16} />
              Nuevo traslado
            </Link>
          </div>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Movimientos de mercadería entre almacenes. Un vendedor solo ve los
          traslados donde su propio almacén es el origen o el destino.
        </p>

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Producto</label>
            <select
              name="producto_id"
              defaultValue={productoId ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {productos?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-sm font-medium text-gray-700">Almacén origen</label>
            <select
              name="almacen_origen_id"
              defaultValue={almacenOrigenId ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {almacenes?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-sm font-medium text-gray-700">Almacén destino</label>
            <select
              name="almacen_destino_id"
              defaultValue={almacenDestinoId ?? ""}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {almacenes?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
            <input
              type="date"
              name="desde"
              defaultValue={desdeEfectivo}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
            <input
              type="date"
              name="hasta"
              defaultValue={hastaEfectivo}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Search size={16} />
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/traslados?desde=&hasta=&producto_id=&almacen_origen_id=&almacen_destino_id="
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

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Origen</th>
                <th className="px-4 py-3 font-medium">Destino</th>
                <th className="px-4 py-3 font-medium">Usuario responsable</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-gray-600">{formatFechaHora(f.fecha)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{f.productoNombre}</td>
                  <td className="px-4 py-3 text-gray-600">{f.cantidad}</td>
                  <td className="px-4 py-3 text-gray-600">{f.origenNombre}</td>
                  <td className="px-4 py-3 text-gray-600">{f.destinoNombre}</td>
                  <td className="px-4 py-3 text-gray-600">{f.usuarioNombre}</td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ningún traslado coincide con los filtros."
                      : "Aún no hay traslados registrados."}
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

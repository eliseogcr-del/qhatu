import Link from "next/link";
import { formatFechaHora, hoyLima, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { Plus, Search, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function AbastecimientoCampoPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; producto_id?: string }>;
}) {
  const { desde, hasta, producto_id: productoId } = await searchParams;
  const supabase = await createClient();

  // Sin parámetros en la URL (primera carga) se muestra el día de hoy por
  // defecto. Si el usuario borra los campos de fecha y filtra, quedan como
  // string vacío (presentes pero sin valor) y ahí sí se ve todo.
  const hoy = hoyLima();
  const desdeEfectivo = desde === undefined ? hoy : desde;
  const hastaEfectivo = hasta === undefined ? hoy : hasta;

  const { data: productos } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  let query = supabase
    .from("abastecimientos_campo")
    .select(
      "id, fecha, nota, almacenes(nombre), proveedores(nombre), usuarios(nombre), abastecimiento_campo_detalle(id, cantidad, producto_id, productos(nombre))",
    )
    .order("fecha", { ascending: false })
    .limit(100);

  if (desdeEfectivo) query = query.gte("fecha", inicioDiaLima(desdeEfectivo));
  if (hastaEfectivo) query = query.lte("fecha", finDiaLima(hastaEfectivo));

  const { data: abastecimientos, error } = await query;

  const hayFiltros = !!(desde !== undefined || hasta !== undefined || productoId);

  const filas = (abastecimientos ?? []).flatMap((a) => {
    const almacen = a.almacenes as unknown as { nombre: string } | null;
    const proveedor = a.proveedores as unknown as { nombre: string } | null;
    const usuario = a.usuarios as unknown as { nombre: string | null } | null;
    const lineas = a.abastecimiento_campo_detalle as unknown as {
      id: string;
      cantidad: number;
      producto_id: string;
      productos: { nombre: string } | null;
    }[];

    return lineas
      .filter((l) => !productoId || l.producto_id === productoId)
      .map((l) => ({
        id: l.id,
        fecha: a.fecha,
        proveedorNombre: proveedor?.nombre ?? "—",
        productoNombre: l.productos?.nombre ?? "—",
        cantidad: l.cantidad,
        almacenNombre: almacen?.nombre ?? "—",
        usuarioNombre: usuario?.nombre ?? "—",
      }));
  });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Abastecimiento en campo</h1>
          <Link
            href="/abastecimiento-campo/nuevo"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={16} />
            Nuevo abastecimiento
          </Link>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Mercadería que un vendedor recogió de un proveedor directamente en
          ruta, sin documento de compra (últimos 100).
        </p>

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Producto</label>
            <select
              key={productoId ?? ""}
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
              href="/abastecimiento-campo?desde=&hasta=&producto_id="
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
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Proveedor</th>
                <th className="px-4 py-3 font-bold">Producto</th>
                <th className="px-4 py-3 font-bold">Cantidad</th>
                <th className="px-4 py-3 font-bold">Almacén</th>
                <th className="px-4 py-3 font-bold">Usuario responsable</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b-2 border-gray-200 last:border-0">
                  <td className="px-4 py-3 text-gray-600">{formatFechaHora(f.fecha)}</td>
                  <td className="px-4 py-3 text-gray-600">{f.proveedorNombre}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{f.productoNombre}</td>
                  <td className="px-4 py-3 text-gray-600">{f.cantidad}</td>
                  <td className="px-4 py-3 text-gray-600">{f.almacenNombre}</td>
                  <td className="px-4 py-3 text-gray-600">{f.usuarioNombre}</td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ningún abastecimiento coincide con los filtros."
                      : "Aún no hay abastecimientos en campo registrados."}
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

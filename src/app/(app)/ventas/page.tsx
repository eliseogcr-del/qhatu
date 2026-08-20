import Link from "next/link";
import { FileDown, Plus, Search, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { fetchVentasConSaldo } from "@/utils/supabase/ventas";
import { hoyLima } from "@/lib/fecha";
import VentaFilaExpandible from "@/components/VentaFilaExpandible";

function buildExportHref(
  base: "/ventas/export" | "/ventas/export-detalle",
  params: {
    q?: string;
    desde?: string;
    hasta?: string;
    pendientes?: string;
    almacen_id?: string;
    vendedor_id?: string;
  },
) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.desde) search.set("desde", params.desde);
  if (params.hasta) search.set("hasta", params.hasta);
  if (params.pendientes) search.set("pendientes", params.pendientes);
  if (params.almacen_id) search.set("almacen_id", params.almacen_id);
  if (params.vendedor_id) search.set("vendedor_id", params.vendedor_id);
  const qs = search.toString();
  return `${base}${qs ? `?${qs}` : ""}`;
}

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    desde?: string;
    hasta?: string;
    pendientes?: string;
    almacen_id?: string;
    vendedor_id?: string;
  }>;
}) {
  const { q, desde, hasta, pendientes, almacen_id: almacenIdParam, vendedor_id: vendedorId } =
    await searchParams;
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);

  // Un vendedor tiene almacén fijo: siempre ve solo sus propias ventas, sin
  // importar qué venga en la URL. Admin/logística (almacenId null) eligen
  // libremente desde el filtro.
  const almacenId = session.almacenId ?? almacenIdParam;

  // Sin parámetros en la URL (primera carga) se muestra el día de hoy por
  // defecto, para no traer todo el historial cada vez. Si el usuario borra
  // los campos de fecha y filtra, quedan como string vacío (presentes pero
  // sin valor) y ahí sí se ve todo.
  const hoy = hoyLima();
  const desdeEfectivo = desde === undefined ? hoy : desde;
  const hastaEfectivo = hasta === undefined ? hoy : hasta;

  let almacenesQuery = supabase
    .from("almacenes")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");
  if (session.almacenId) almacenesQuery = almacenesQuery.eq("id", session.almacenId);

  const [{ ventas, error }, { data: almacenes }, { data: vendedores }] = await Promise.all([
    fetchVentasConSaldo(supabase, {
      clienteNombre: q,
      fechaDesde: desdeEfectivo,
      fechaHasta: hastaEfectivo,
      soloPendientes: pendientes === "1",
      almacenId,
      vendedorId,
    }),
    almacenesQuery,
    supabase
      .from("usuarios")
      .select("id, nombre")
      .eq("rol", "vendedor")
      .not("almacen_id", "is", null)
      .order("nombre"),
  ]);

  const hayFiltros = !!(
    q ||
    desde !== undefined ||
    hasta !== undefined ||
    pendientes ||
    (!session.almacenId && almacenId) ||
    vendedorId
  );

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Ventas</h1>
          <div className="flex items-center gap-3">
            <a
              href={buildExportHref("/ventas/export", {
                q,
                desde: desdeEfectivo,
                hasta: hastaEfectivo,
                pendientes,
                almacen_id: almacenId,
                vendedor_id: vendedorId,
              })}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={16} />
              Exportar resumen
            </a>
            <a
              href={buildExportHref("/ventas/export-detalle", {
                q,
                desde: desdeEfectivo,
                hasta: hastaEfectivo,
                pendientes,
                almacen_id: almacenId,
                vendedor_id: vendedorId,
              })}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <FileDown size={16} />
              Exportar detalle de pagos
            </a>
            <Link
              href="/ventas/nueva"
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              <Plus size={16} />
              Registrar venta
            </Link>
          </div>
        </div>

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Cliente
            </label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por nombre..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Desde
            </label>
            <input
              type="date"
              name="desde"
              defaultValue={desdeEfectivo}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Hasta
            </label>
            <input
              type="date"
              name="hasta"
              defaultValue={hastaEfectivo}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Almacén
            </label>
            {session.almacenId ? (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {almacenes?.[0]?.nombre ?? "Tu almacén"}
              </p>
            ) : (
              <select
                name="almacen_id"
                defaultValue={almacenId ?? ""}
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
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Vendedor
            </label>
            <select
              name="vendedor_id"
              defaultValue={vendedorId ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {vendedores?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.nombre}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="pendientes"
              value="1"
              defaultChecked={pendientes === "1"}
              className="h-4 w-4 rounded border-gray-300"
            />
            Solo pendientes de pago
          </label>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/ventas?desde=&hasta="
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Limpiar
            </Link>
          )}
        </form>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-2 py-3" />
                <th className="px-4 py-3 font-bold">Código</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Local</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Pagado</th>
                <th className="px-4 py-3 font-bold">Saldo pendiente</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {ventas.map((venta) => (
                <VentaFilaExpandible key={venta.id} venta={venta} />
              ))}

              {ventas.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ninguna venta coincide con los filtros."
                      : "Aún no hay ventas registradas."}
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

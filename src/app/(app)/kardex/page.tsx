import Link from "next/link";
import { Search, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { TIPO_MOVIMIENTO_LABEL, type TipoMovimiento } from "@/lib/kardex-tipos";

export default async function KardexPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; producto_id?: string }>;
}) {
  const { desde, hasta, producto_id } = await searchParams;
  const supabase = await createClient();

  const { data: productos } = await supabase
    .from("productos")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  let query = supabase
    .from("kardex_movimientos")
    .select(
      "id, fecha, tipo_movimiento, cantidad, saldo_resultante, detalle, productos(nombre), almacenes(nombre), usuarios(nombre)",
    )
    .order("fecha", { ascending: false })
    .limit(200);

  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", `${hasta}T23:59:59`);
  if (producto_id) query = query.eq("producto_id", producto_id);

  const { data: movimientos, error } = await query;

  const hayFiltros = !!(desde || hasta || producto_id);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">Kardex</h1>
        <p className="mb-4 text-sm text-gray-500">
          Registro inmutable de movimientos de stock (últimos 200).
        </p>

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Producto</label>
            <select
              name="producto_id"
              defaultValue={producto_id ?? ""}
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
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Search size={16} />
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/kardex"
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
                <th className="px-4 py-3 font-medium">Almacén</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Saldo resultante</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {movimientos?.map((m) => {
                const producto = m.productos as unknown as { nombre: string } | null;
                const almacen = m.almacenes as unknown as { nombre: string } | null;
                const usuario = m.usuarios as unknown as { nombre: string | null } | null;
                return (
                  <tr key={m.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(m.fecha).toLocaleString("es-PE")}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {producto?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{almacen?.nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {TIPO_MOVIMIENTO_LABEL[m.tipo_movimiento as TipoMovimiento] ??
                        m.tipo_movimiento}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${m.cantidad < 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.saldo_resultante}</td>
                    <td className="px-4 py-3 text-gray-600">{usuario?.nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{m.detalle ?? "—"}</td>
                  </tr>
                );
              })}
              {movimientos?.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ningún movimiento coincide con los filtros."
                      : "Aún no hay movimientos registrados."}
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

import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import { TIPO_MOVIMIENTO_LABEL, ENTIDAD_LABEL } from "@/lib/auditoria-tipos";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{
    desde?: string;
    hasta?: string;
    entidad?: string;
    tipo?: string;
  }>;
}) {
  const supabase = await createClient();
  await requireAdmin(supabase);

  const { desde, hasta, entidad, tipo } = await searchParams;

  let query = supabase
    .from("auditoria")
    .select(
      "id, fecha, entidad, entidad_id, tipo_movimiento, producto_nombre, cantidad, precio_unitario, monto, detalle, usuarios(nombre)",
    )
    .order("fecha", { ascending: false })
    .limit(300);

  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", `${hasta}T23:59:59`);
  if (entidad) query = query.eq("entidad", entidad);
  if (tipo) query = query.eq("tipo_movimiento", tipo);

  const { data: registros, error } = await query;

  const hayFiltros = !!(desde || hasta || entidad || tipo);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck size={24} className="text-emerald-700" />
          <h1 className="text-2xl font-semibold text-gray-900">Auditoría</h1>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Registro inmutable de ediciones y anulaciones sobre ventas y
          cobranzas — quién, cuándo, y qué cambió. Solo visible para
          administradores.
        </p>

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Desde
            </label>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
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
              defaultValue={hasta ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Entidad
            </label>
            <select
              name="entidad"
              defaultValue={entidad ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todas</option>
              <option value="venta">Venta</option>
              <option value="cobranza">Cobranza</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Tipo de movimiento
            </label>
            <select
              name="tipo"
              defaultValue={tipo ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Todos</option>
              {Object.entries(TIPO_MOVIMIENTO_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/auditoria"
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
                <th className="px-4 py-3 font-medium">Fecha y hora</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Entidad</th>
                <th className="px-4 py-3 font-medium">Movimiento</th>
                <th className="px-4 py-3 font-medium">Producto</th>
                <th className="px-4 py-3 font-medium">Cantidad</th>
                <th className="px-4 py-3 font-medium">Precio unit.</th>
                <th className="px-4 py-3 font-medium">Monto</th>
                <th className="px-4 py-3 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros?.map((r) => {
                const usuario = r.usuarios as unknown as { nombre: string | null } | null;
                return (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {new Date(r.fecha).toLocaleString("es-PE")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {usuario?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ENTIDAD_LABEL[r.entidad] ?? r.entidad}
                    </td>
                    <td className="px-4 py-3 text-gray-900">
                      {TIPO_MOVIMIENTO_LABEL[r.tipo_movimiento] ?? r.tipo_movimiento}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.producto_nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.cantidad ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r.precio_unitario ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{r.monto ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{r.detalle ?? "—"}</td>
                  </tr>
                );
              })}

              {registros?.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ningún registro coincide con los filtros."
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

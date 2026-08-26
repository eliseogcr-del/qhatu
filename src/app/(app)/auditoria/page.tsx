import { formatFechaHora, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import { TIPO_MOVIMIENTO_LABEL, ENTIDAD_LABEL } from "@/lib/auditoria-tipos";
import AuditoriaFiltroForm from "@/components/AuditoriaFiltroForm";
import ResultadosCount from "@/components/ResultadosCount";

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

  if (desde) query = query.gte("fecha", inicioDiaLima(desde));
  if (hasta) query = query.lte("fecha", finDiaLima(hasta));
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

        <AuditoriaFiltroForm
          desde={desde ?? ""}
          hasta={hasta ?? ""}
          entidad={entidad ?? ""}
          tipo={tipo ?? ""}
          opcionesTipo={Object.entries(TIPO_MOVIMIENTO_LABEL).map(([value, label]) => ({
            value,
            label,
          }))}
          hayFiltros={hayFiltros}
        />

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <ResultadosCount count={registros?.length ?? 0} />

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Fecha y hora</th>
                <th className="px-4 py-3 font-bold">Usuario</th>
                <th className="px-4 py-3 font-bold">Entidad</th>
                <th className="px-4 py-3 font-bold">Movimiento</th>
                <th className="px-4 py-3 font-bold">Producto</th>
                <th className="px-4 py-3 font-bold">Cantidad</th>
                <th className="px-4 py-3 font-bold">Precio unit.</th>
                <th className="px-4 py-3 font-bold">Monto</th>
                <th className="px-4 py-3 font-bold">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {registros?.map((r) => {
                const usuario = r.usuarios as unknown as { nombre: string | null } | null;
                return (
                  <tr key={r.id} className="border-b-2 border-gray-200 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {formatFechaHora(r.fecha)}
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

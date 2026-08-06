import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { buildGoogleMapsLink, buildGoogleMapsMultiStopLink } from "@/lib/maps";
import {
  ESTADO_REPARTO_BADGE,
  ESTADO_REPARTO_LABEL,
  TIPO_TRANSPORTE_LABEL,
  type EstadoReparto,
  type TipoTransporte,
} from "@/lib/reparto-estados";

type ClienteDestino = {
  nombre: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
};

export default async function RepartosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("repartos")
    .select(
      "id, fecha_reparto, tipo_transporte, transportista_nombre, estado, usuarios(nombre), pedidos(id, clientes(nombre, direccion, latitud, longitud))",
    )
    .order("fecha_reparto", { ascending: false });

  if (fecha) query = query.eq("fecha_reparto", fecha);

  const { data: repartos, error } = await query;

  const destinos = (repartos ?? [])
    .filter((r) => r.estado !== "cancelado")
    .map((r) => (r.pedidos as unknown as { clientes: ClienteDestino } | null)?.clientes)
    .filter((c): c is ClienteDestino => !!c);

  const rutaCombinada = fecha ? buildGoogleMapsMultiStopLink(destinos) : null;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Reparto</h1>
          <Link
            href="/repartos/nuevo"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + Asignar reparto
          </Link>
        </div>

        <form className="mb-4 flex items-end gap-3" method="get">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Filtrar por fecha de reparto
            </label>
            <input
              type="date"
              name="fecha"
              defaultValue={fecha ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Filtrar
          </button>
          {fecha && (
            <Link
              href="/repartos"
              className="text-sm font-medium text-gray-500 hover:underline"
            >
              Limpiar
            </Link>
          )}
          {rutaCombinada && (
            <a
              href={rutaCombinada}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ver ruta combinada del día ({destinos.length} paradas)
            </a>
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
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Fecha reparto</th>
                <th className="px-4 py-3 font-medium">Transporte</th>
                <th className="px-4 py-3 font-medium">Repartidor</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {repartos?.map((reparto) => {
                const cliente = (
                  reparto.pedidos as unknown as { clientes: ClienteDestino } | null
                )?.clientes;
                const repartidor = reparto.usuarios as unknown as {
                  nombre: string | null;
                } | null;
                const estado = reparto.estado as EstadoReparto;
                const link = cliente ? buildGoogleMapsLink(cliente) : null;

                return (
                  <tr key={reparto.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {cliente?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {reparto.fecha_reparto ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {TIPO_TRANSPORTE_LABEL[reparto.tipo_transporte as TipoTransporte] ??
                        reparto.tipo_transporte}
                      {reparto.transportista_nombre
                        ? ` (${reparto.transportista_nombre})`
                        : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {repartidor?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_REPARTO_BADGE[estado]}`}
                      >
                        {ESTADO_REPARTO_LABEL[estado] ?? reparto.estado}
                      </span>
                    </td>
                    <td className="space-x-3 px-4 py-3 text-right">
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-blue-600 hover:underline"
                        >
                          Ver ruta
                        </a>
                      )}
                      <Link
                        href={`/repartos/${reparto.id}/editar`}
                        className="text-sm font-medium text-gray-700 hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {repartos?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay repartos asignados.
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

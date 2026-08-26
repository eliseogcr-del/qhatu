import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { hoyLima } from "@/lib/fecha";
import { buildGoogleMapsLink, buildGoogleMapsMultiStopLink } from "@/lib/maps";
import {
  ESTADOS_REPARTO,
  ESTADO_REPARTO_BADGE,
  ESTADO_REPARTO_LABEL,
  TIPO_TRANSPORTE_LABEL,
  type EstadoReparto,
  type TipoTransporte,
} from "@/lib/reparto-estados";
import RepartosFiltroForm from "@/components/RepartosFiltroForm";
import ResultadosCount from "@/components/ResultadosCount";

type ClienteDestino = {
  nombre: string;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
};

export default async function RepartosPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; estado?: string }>;
}) {
  const { fecha, estado } = await searchParams;
  const supabase = await createClient();

  // Primera carga (sin ningún parámetro en la URL): se ven los repartos de
  // hoy MÁS cualquier pendiente de otros días (para que uno atrasado no se
  // pierda de vista). En cuanto el usuario toca fecha o estado, el filtro
  // pasa a ser estricto (AND) sobre lo que haya elegido explícitamente.
  const esCargaInicial = fecha === undefined && estado === undefined;
  const fechaEfectiva = fecha === undefined ? hoyLima() : fecha;

  let query = supabase
    .from("repartos")
    .select(
      "id, fecha_reparto, tipo_transporte, transportista_nombre, estado, usuarios(nombre), pedidos(id, clientes(nombre, direccion, latitud, longitud))",
    )
    .order("fecha_reparto", { ascending: false });

  if (esCargaInicial) {
    query = query.or(`fecha_reparto.eq.${fechaEfectiva},estado.eq.pendiente`);
  } else {
    if (fechaEfectiva) query = query.eq("fecha_reparto", fechaEfectiva);
    if (estado) query = query.eq("estado", estado);
  }

  const { data: repartos, error } = await query;

  // "Ruta combinada del día" siempre se arma solo con lo de fechaEfectiva,
  // incluso en la carga inicial donde `repartos` también trae pendientes
  // de otros días (esos no deben mezclarse en esta ruta).
  const destinos = (repartos ?? [])
    .filter((r) => r.estado !== "cancelado" && r.fecha_reparto === fechaEfectiva)
    .map((r) => (r.pedidos as unknown as { clientes: ClienteDestino } | null)?.clientes)
    .filter((c): c is ClienteDestino => !!c);

  const rutaCombinada = fechaEfectiva ? buildGoogleMapsMultiStopLink(destinos) : null;

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

        {esCargaInicial && (
          <p className="mb-4 text-sm text-gray-500">
            Mostrando los repartos de hoy y cualquier pendiente de días
            anteriores.
          </p>
        )}

        <RepartosFiltroForm
          fecha={fechaEfectiva}
          estado={estado ?? ""}
          opcionesEstado={ESTADOS_REPARTO.map((e) => ({ value: e, label: ESTADO_REPARTO_LABEL[e] }))}
          esCargaInicial={esCargaInicial}
          rutaCombinada={rutaCombinada}
          numParadas={destinos.length}
        />

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <ResultadosCount count={repartos?.length ?? 0} />

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Fecha reparto</th>
                <th className="px-4 py-3 font-bold">Transporte</th>
                <th className="px-4 py-3 font-bold">Repartidor</th>
                <th className="px-4 py-3 font-bold">Estado</th>
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
                  <tr key={reparto.id} className="border-b-2 border-gray-200 last:border-0">
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

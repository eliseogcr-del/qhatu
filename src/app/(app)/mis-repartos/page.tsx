import { MapPin, Phone, RefreshCw } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { buildGoogleMapsLink } from "@/lib/maps";
import {
  ESTADOS_REPARTO,
  ESTADO_REPARTO_BADGE,
  ESTADO_REPARTO_LABEL,
  type EstadoReparto,
} from "@/lib/reparto-estados";
import SubmitButton from "@/components/SubmitButton";
import { actualizarEstadoReparto } from "../repartos/actions";

type Cliente = {
  nombre: string;
  direccion: string | null;
  telefono: string | null;
  latitud: number | null;
  longitud: number | null;
};

export default async function MisRepartosPage() {
  const supabase = await createClient();
  const { userId } = await getEmpresaSession(supabase);

  const { data: repartos, error } = await supabase
    .from("repartos")
    .select(
      "id, fecha_reparto, estado, pedidos(clientes(nombre, direccion, telefono, latitud, longitud), pedido_detalle(cantidad, productos(nombre)))",
    )
    .eq("repartidor_id", userId)
    .order("fecha_reparto", { ascending: false });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">Mis repartos</h1>
        <p className="mb-6 text-sm text-gray-500">
          Las entregas que tienes asignadas. Actualiza el estado a medida
          que avanzas.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="space-y-4">
          {repartos?.map((r) => {
            const pedido = r.pedidos as unknown as {
              clientes: Cliente | null;
              pedido_detalle: { cantidad: number; productos: { nombre: string } | null }[];
            } | null;
            const cliente = pedido?.clientes ?? null;
            const link = cliente ? buildGoogleMapsLink(cliente) : null;
            const estado = r.estado as EstadoReparto;

            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{cliente?.nombre ?? "—"}</p>
                    <p className="text-xs text-gray-500">{cliente?.direccion ?? "—"}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_REPARTO_BADGE[estado]}`}
                  >
                    {ESTADO_REPARTO_LABEL[estado] ?? r.estado}
                  </span>
                </div>

                <div className="px-4 py-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                    Productos
                  </p>
                  <ul className="space-y-1 text-sm text-gray-700">
                    {(pedido?.pedido_detalle ?? []).map((d, i) => (
                      <li key={i}>
                        {d.cantidad} × {d.productos?.nombre ?? "—"}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
                  <div className="flex items-center gap-4">
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
                      >
                        <MapPin size={14} />
                        Ver ruta
                      </a>
                    )}
                    {cliente?.telefono && (
                      <a
                        href={`tel:${cliente.telefono}`}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
                      >
                        <Phone size={14} />
                        {cliente.telefono}
                      </a>
                    )}
                  </div>
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      await actualizarEstadoReparto(r.id, String(formData.get("estado")));
                    }}
                    className="flex items-center gap-2"
                  >
                    <select
                      key={estado}
                      name="estado"
                      defaultValue={estado}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      {ESTADOS_REPARTO.map((e) => (
                        <option key={e} value={e}>
                          {ESTADO_REPARTO_LABEL[e]}
                        </option>
                      ))}
                    </select>
                    <SubmitButton icon={<RefreshCw size={14} />} pendingLabel="Actualizando...">
                      Actualizar
                    </SubmitButton>
                  </form>
                </div>
              </div>
            );
          })}

          {repartos?.length === 0 && (
            <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
              No tienes repartos asignados por ahora.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

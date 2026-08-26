"use client";

import { useRouter, usePathname } from "next/navigation";

type Opcion = { id: string; nombre: string };

export default function PlanificacionTrasladosFiltroForm({
  fecha,
  almacenOrigenId,
  almacenes,
  // Un vendedor tiene almacén fijo: no hay nada que elegir, se manda tal cual.
  almacenFijoId,
}: {
  fecha: string;
  almacenOrigenId: string;
  almacenes: Opcion[];
  almacenFijoId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const navegar = (params: { fecha: string; almacen_origen_id: string }) => {
    const usp = new URLSearchParams();
    if (params.fecha) usp.set("fecha", params.fecha);
    if (params.almacen_origen_id) usp.set("almacen_origen_id", params.almacen_origen_id);
    router.push(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="mb-4 flex items-end gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de entrega</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) =>
            navegar({
              fecha: e.target.value,
              almacen_origen_id: almacenFijoId ?? almacenOrigenId,
            })
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      {!almacenFijoId && (
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Almacén de origen</label>
          <select
            value={almacenOrigenId}
            onChange={(e) => navegar({ fecha, almacen_origen_id: e.target.value })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Selecciona un almacén</option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

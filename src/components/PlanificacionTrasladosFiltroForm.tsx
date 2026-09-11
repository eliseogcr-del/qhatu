"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";

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
  const hayAlmacenElegido = !!(almacenFijoId || almacenOrigenId);
  const [abierto, setAbierto] = useState(!hayAlmacenElegido);

  const navegar = (params: { fecha: string; almacen_origen_id: string }) => {
    const usp = new URLSearchParams();
    if (params.fecha) usp.set("fecha", params.fecha);
    if (params.almacen_origen_id) usp.set("almacen_origen_id", params.almacen_origen_id);
    router.push(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-gray-500" />
          Filtros
          {hayAlmacenElegido && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Activos
            </span>
          )}
        </span>
        {abierto ? (
          <ChevronUp size={16} className="text-gray-500" />
        ) : (
          <ChevronDown size={16} className="text-gray-500" />
        )}
      </button>

      {abierto && (
        <div className="flex items-end gap-3 border-t border-gray-100 p-4">
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
      )}
    </div>
  );
}

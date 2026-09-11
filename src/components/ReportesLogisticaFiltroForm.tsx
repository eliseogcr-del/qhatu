"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";

type Opcion = { id: string; nombre: string };

export default function ReportesLogisticaFiltroForm({
  desde,
  hasta,
  almacenId,
  almacenes,
  almacenFijoNombre,
  hayFiltros,
}: {
  desde: string;
  hasta: string;
  almacenId: string;
  almacenes: Opcion[];
  // Un vendedor tiene almacén fijo — se muestra como texto, no como select.
  almacenFijoNombre: string | null;
  hayFiltros: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(!hayFiltros);

  const navegar = (params: { desde: string; hasta: string; almacen_id: string }) => {
    const usp = new URLSearchParams();
    // desde/hasta: se mandan siempre (incluso vacíos) para distinguir
    // "sin filtro explícito" (usa el día de hoy por defecto) de
    // "el usuario los vació a propósito" — igual que en Ventas y Kardex.
    usp.set("desde", params.desde);
    usp.set("hasta", params.hasta);
    if (params.almacen_id) usp.set("almacen_id", params.almacen_id);
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
          {hayFiltros && (
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
        <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Almacén</label>
            {almacenFijoNombre ? (
              <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                {almacenFijoNombre}
              </p>
            ) : (
              <select
                value={almacenId}
                onChange={(e) => navegar({ desde, hasta, almacen_id: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => navegar({ desde: e.target.value, hasta, almacen_id: almacenId })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => navegar({ desde, hasta: e.target.value, almacen_id: almacenId })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {hayFiltros && (
            <button
              type="button"
              onClick={() => navegar({ desde: "", hasta: "", almacen_id: "" })}
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

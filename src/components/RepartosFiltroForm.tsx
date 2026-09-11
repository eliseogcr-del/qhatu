"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";

type Opcion = { value: string; label: string };

export default function RepartosFiltroForm({
  fecha,
  estado,
  opcionesEstado,
  esCargaInicial,
  rutaCombinada,
  numParadas,
}: {
  fecha: string;
  estado: string;
  opcionesEstado: Opcion[];
  esCargaInicial: boolean;
  rutaCombinada: string | null;
  numParadas: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(esCargaInicial);

  const navegar = (params: { fecha: string; estado: string }) => {
    const usp = new URLSearchParams();
    usp.set("fecha", params.fecha);
    usp.set("estado", params.estado);
    router.push(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="mb-4 flex flex-wrap items-start gap-3">
      <div className="flex-1 rounded-xl border border-gray-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-gray-500" />
            Filtros
            {!esCargaInicial && (
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Fecha de reparto</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => navegar({ fecha: e.target.value, estado })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
              <select
                value={estado}
                onChange={(e) => navegar({ fecha, estado: e.target.value })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {opcionesEstado.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {!esCargaInicial && (
              <button
                type="button"
                onClick={() => navegar({ fecha: "", estado: "" })}
                className="text-sm font-medium text-gray-500 hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>
        )}
      </div>
      {rutaCombinada && (
        <a
          href={rutaCombinada}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Ver ruta combinada del día ({numParadas} paradas)
        </a>
      )}
    </div>
  );
}

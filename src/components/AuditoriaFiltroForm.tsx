"use client";

import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";

type Opcion = { value: string; label: string };

export default function AuditoriaFiltroForm({
  desde,
  hasta,
  entidad,
  tipo,
  opcionesTipo,
  hayFiltros,
}: {
  desde: string;
  hasta: string;
  entidad: string;
  tipo: string;
  opcionesTipo: Opcion[];
  hayFiltros: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const navegar = (params: { desde: string; hasta: string; entidad: string; tipo: string }) => {
    const usp = new URLSearchParams();
    if (params.desde) usp.set("desde", params.desde);
    if (params.hasta) usp.set("hasta", params.hasta);
    if (params.entidad) usp.set("entidad", params.entidad);
    if (params.tipo) usp.set("tipo", params.tipo);
    router.push(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
        <input
          type="date"
          value={desde}
          onChange={(e) => navegar({ desde: e.target.value, hasta, entidad, tipo })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
        <input
          type="date"
          value={hasta}
          onChange={(e) => navegar({ desde, hasta: e.target.value, entidad, tipo })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Entidad</label>
        <select
          value={entidad}
          onChange={(e) => navegar({ desde, hasta, entidad: e.target.value, tipo })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todas</option>
          <option value="venta">Venta</option>
          <option value="cobranza">Cobranza</option>
          <option value="produccion">Producción</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de movimiento</label>
        <select
          value={tipo}
          onChange={(e) => navegar({ desde, hasta, entidad, tipo: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          {opcionesTipo.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {hayFiltros && (
        <button
          type="button"
          onClick={() => navegar({ desde: "", hasta: "", entidad: "", tipo: "" })}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
        >
          <X size={14} />
          Limpiar
        </button>
      )}
    </div>
  );
}

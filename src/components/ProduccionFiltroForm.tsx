"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, SlidersHorizontal, X } from "lucide-react";

type Opcion = { id: string; nombre: string };

export default function ProduccionFiltroForm({
  desde,
  hasta,
  productoId,
  productos,
  hayFiltros,
}: {
  desde: string;
  hasta: string;
  productoId: string;
  productos: Opcion[];
  hayFiltros: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(!hayFiltros);

  const navegar = (params: { desde: string; hasta: string; producto_id: string }) => {
    const usp = new URLSearchParams();
    // desde/hasta: se mandan siempre (incluso vacíos) para distinguir
    // "sin filtro explícito" (usa el día de hoy por defecto) de
    // "el usuario los vació a propósito" — igual que antes con el form GET.
    usp.set("desde", params.desde);
    usp.set("hasta", params.hasta);
    if (params.producto_id) usp.set("producto_id", params.producto_id);
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
      <div className="min-w-[200px] flex-1">
        <label className="mb-1 block text-sm font-medium text-gray-700">Producto</label>
        <select
          value={productoId}
          onChange={(e) => navegar({ desde, hasta, producto_id: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
        <input
          type="date"
          value={desde}
          onChange={(e) => navegar({ desde: e.target.value, hasta, producto_id: productoId })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
        <input
          type="date"
          value={hasta}
          onChange={(e) => navegar({ desde, hasta: e.target.value, producto_id: productoId })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      {hayFiltros && (
        <button
          type="button"
          onClick={() => navegar({ desde: "", hasta: "", producto_id: "" })}
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

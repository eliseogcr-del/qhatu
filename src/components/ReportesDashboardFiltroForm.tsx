"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";

export default function ReportesDashboardFiltroForm({
  desde,
  hasta,
}: {
  desde: string;
  hasta: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(true);

  const navegar = (params: { desde: string; hasta: string }) => {
    const usp = new URLSearchParams();
    usp.set("desde", params.desde);
    usp.set("hasta", params.hasta);
    router.push(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-gray-500" />
          Filtros
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => navegar({ desde: e.target.value, hasta })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => navegar({ desde, hasta: e.target.value })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => router.push(pathname)}
            className="text-sm font-medium text-gray-500 hover:underline"
          >
            Restablecer al mes actual
          </button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";

export default function ReportesDiferenciasFiltroForm({
  desde,
  hasta,
  hayFiltros,
}: {
  desde: string;
  hasta: string;
  hayFiltros: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const navegar = (params: { desde: string; hasta: string }) => {
    const usp = new URLSearchParams();
    if (params.desde) usp.set("desde", params.desde);
    if (params.hasta) usp.set("hasta", params.hasta);
    router.push(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="mb-4 flex items-end gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
        <input
          type="date"
          value={desde}
          onChange={(e) => navegar({ desde: e.target.value, hasta })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
        <input
          type="date"
          value={hasta}
          onChange={(e) => navegar({ desde, hasta: e.target.value })}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      {hayFiltros && (
        <button
          type="button"
          onClick={() => navegar({ desde: "", hasta: "" })}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
        >
          <X size={14} />
          Limpiar
        </button>
      )}
    </div>
  );
}

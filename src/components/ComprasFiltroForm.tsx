"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

export default function ComprasFiltroForm({
  q,
  desde,
  hasta,
  pendientes,
  hayFiltros,
}: {
  q: string;
  desde: string;
  hasta: string;
  pendientes: boolean;
  hayFiltros: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const primerRender = useRef(true);

  const navegar = (params: { q: string; desde: string; hasta: string; pendientes: string }) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set("q", params.q);
    if (params.desde) usp.set("desde", params.desde);
    if (params.hasta) usp.set("hasta", params.hasta);
    if (params.pendientes) usp.set("pendientes", params.pendientes);
    router.push(`${pathname}?${usp.toString()}`);
  };

  // Búsqueda por proveedor: espera una pausa al escribir antes de filtrar;
  // el resto de filtros navega al toque, sin botón "Filtrar".
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      navegar({ q: query, desde, hasta, pendientes: pendientes ? "1" : "" });
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="min-w-[200px] flex-1">
        <label className="mb-1 block text-sm font-medium text-gray-700">Proveedor</label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
        <input
          type="date"
          value={desde}
          onChange={(e) =>
            navegar({ q: query, desde: e.target.value, hasta, pendientes: pendientes ? "1" : "" })
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
        <input
          type="date"
          value={hasta}
          onChange={(e) =>
            navegar({ q: query, desde, hasta: e.target.value, pendientes: pendientes ? "1" : "" })
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={pendientes}
          onChange={(e) =>
            navegar({ q: query, desde, hasta, pendientes: e.target.checked ? "1" : "" })
          }
          className="h-4 w-4 rounded border-gray-300"
        />
        Solo pendientes de pago
      </label>
      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            navegar({ q: "", desde: "", hasta: "", pendientes: "" });
          }}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
        >
          <X size={14} />
          Limpiar
        </button>
      )}
    </div>
  );
}

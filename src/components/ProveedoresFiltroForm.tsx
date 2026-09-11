"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";

export default function ProveedoresFiltroForm({ q }: { q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const primerRender = useRef(true);
  const [abierto, setAbierto] = useState(!q);

  const navegar = (nuevoQuery: string) => {
    const usp = new URLSearchParams();
    if (nuevoQuery) usp.set("q", nuevoQuery);
    router.push(`${pathname}?${usp.toString()}`);
  };

  // Búsqueda por nombre: se espera una pausa al escribir antes de filtrar,
  // sin botón "Buscar".
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      navegar(query);
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

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
          {q && (
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
        <div className="flex items-center gap-2 border-t border-gray-100 p-4">
          <div className="relative max-w-sm flex-1">
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
          {q && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                navegar("");
              }}
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

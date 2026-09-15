"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";

// Filtros de "Mis ventas" (almacén móvil): versión reducida y con
// controles grandes de VentasFiltroForm — sin Almacén/Vendedor (son
// fijos para ella) y pensada para tocar rápido con el pulgar.
export default function MisVentasFiltroForm({
  q,
  desde,
  hasta,
  pendientes,
  hayFiltros,
  oscuro,
}: {
  q: string;
  desde: string;
  hasta: string;
  pendientes: boolean;
  hayFiltros: boolean;
  oscuro: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const primerRender = useRef(true);
  const [abierto, setAbierto] = useState(!hayFiltros);

  const navegar = (params: { q: string; desde: string; hasta: string; pendientes: string }) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set("q", params.q);
    usp.set("desde", params.desde);
    usp.set("hasta", params.hasta);
    if (params.pendientes) usp.set("pendientes", params.pendientes);
    router.push(`${pathname}?${usp.toString()}`);
  };

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

  const claseCampo = oscuro
    ? "w-full rounded-lg border-2 border-gray-600 bg-gray-800 py-2.5 pl-10 pr-3 text-base font-medium text-gray-100 focus:border-emerald-400 focus:outline-none"
    : "w-full rounded-lg border-2 border-gray-300 py-2.5 pl-10 pr-3 text-base font-medium focus:border-emerald-500 focus:outline-none";
  const claseFecha = oscuro
    ? "w-full rounded-lg border-2 border-gray-600 bg-gray-800 px-3 py-2.5 text-base font-medium text-gray-100"
    : "w-full rounded-lg border-2 border-gray-300 px-3 py-2.5 text-base font-medium";
  const claseLabel = oscuro
    ? "mb-1 block text-sm font-semibold text-gray-300"
    : "mb-1 block text-sm font-semibold text-gray-700";

  return (
    <div
      className={
        oscuro
          ? "mb-4 rounded-xl border-2 border-gray-700 bg-gray-900 shadow-sm"
          : "mb-4 rounded-xl border-2 border-gray-200 bg-white shadow-sm"
      }
    >
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={
          oscuro
            ? "flex w-full items-center justify-between px-4 py-3.5 text-base font-bold text-gray-100"
            : "flex w-full items-center justify-between px-4 py-3.5 text-base font-bold text-gray-800"
        }
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal size={18} className={oscuro ? "text-gray-400" : "text-gray-500"} />
          Filtros
          {hayFiltros && (
            <span
              className={
                oscuro
                  ? "rounded-full bg-emerald-950 px-2 py-0.5 text-sm font-semibold text-emerald-300"
                  : "rounded-full bg-emerald-100 px-2 py-0.5 text-sm font-semibold text-emerald-700"
              }
            >
              Activos
            </span>
          )}
        </span>
        {abierto ? (
          <ChevronUp size={20} className={oscuro ? "text-gray-400" : "text-gray-500"} />
        ) : (
          <ChevronDown size={20} className={oscuro ? "text-gray-400" : "text-gray-500"} />
        )}
      </button>

      {abierto && (
        <div
          className={
            oscuro
              ? "space-y-3 border-t border-gray-700 p-4"
              : "space-y-3 border-t border-gray-100 p-4"
          }
        >
          <div>
            <label className={claseLabel}>Cliente</label>
            <div className="relative">
              <Search
                size={18}
                className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${oscuro ? "text-gray-500" : "text-gray-400"}`}
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre..."
                className={claseCampo}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={claseLabel}>Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) =>
                  navegar({ q: query, desde: e.target.value, hasta, pendientes: pendientes ? "1" : "" })
                }
                className={claseFecha}
              />
            </div>
            <div>
              <label className={claseLabel}>Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) =>
                  navegar({ q: query, desde, hasta: e.target.value, pendientes: pendientes ? "1" : "" })
                }
                className={claseFecha}
              />
            </div>
          </div>
          <label
            className={`flex items-center gap-2 text-base font-medium ${oscuro ? "text-gray-200" : "text-gray-700"}`}
          >
            <input
              type="checkbox"
              checked={pendientes}
              onChange={(e) =>
                navegar({ q: query, desde, hasta, pendientes: e.target.checked ? "1" : "" })
              }
              className="h-5 w-5 rounded border-gray-300"
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
              className={`flex items-center gap-1 text-base font-semibold hover:underline ${oscuro ? "text-gray-400" : "text-gray-500"}`}
            >
              <X size={16} />
              Limpiar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

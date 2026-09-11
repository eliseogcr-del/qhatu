"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";

type Opcion = { id: string; nombre: string };
type ResumenMetodo = { metodo: string; label: string; monto: number };

export default function VentasFiltroForm({
  q,
  desde,
  hasta,
  almacenId,
  vendedorId,
  pendientes,
  almacenes,
  vendedores,
  almacenFijoNombre,
  hayFiltros,
  pagosPorMetodo,
  totalPagosResumen,
  monedaResumen,
}: {
  q: string;
  desde: string;
  hasta: string;
  almacenId: string;
  vendedorId: string;
  pendientes: boolean;
  almacenes: Opcion[];
  vendedores: Opcion[];
  // Un vendedor tiene almacén fijo — se muestra como texto, no como select.
  almacenFijoNombre: string | null;
  hayFiltros: boolean;
  pagosPorMetodo: ResumenMetodo[];
  totalPagosResumen: number;
  monedaResumen: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const primerRender = useRef(true);
  // Cerrado por defecto en cuanto hay un filtro aplicado (el caso típico
  // en celular: ya elegiste qué ver, ahora hace falta el espacio para la
  // grilla) — se recalcula solo al recargar tras cambiar un filtro, ya
  // que ese cambio siempre trae un round-trip al servidor.
  const [abierto, setAbierto] = useState(!hayFiltros);

  const navegar = (params: Record<string, string>) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set("q", params.q);
    // desde/hasta: se mandan siempre (incluso vacíos) para distinguir
    // "sin filtro explícito" (usa el día de hoy por defecto) de
    // "el usuario los vació a propósito" — igual que antes con el form GET.
    usp.set("desde", params.desde);
    usp.set("hasta", params.hasta);
    if (params.almacen_id) usp.set("almacen_id", params.almacen_id);
    if (params.vendedor_id) usp.set("vendedor_id", params.vendedor_id);
    if (params.pendientes) usp.set("pendientes", params.pendientes);
    router.push(`${pathname}?${usp.toString()}`);
  };

  // Búsqueda por nombre: se espera una pausa al escribir antes de filtrar,
  // para no navegar en cada tecla — el resto de filtros navega al toque.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      navegar({ q: query, desde, hasta, almacen_id: almacenId, vendedor_id: vendedorId, pendientes: pendientes ? "1" : "" });
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
          Filtros y resumen
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
        <div className="space-y-4 border-t border-gray-100 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Cliente</label>
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
                  navegar({
                    q: query,
                    desde: e.target.value,
                    hasta,
                    almacen_id: almacenId,
                    vendedor_id: vendedorId,
                    pendientes: pendientes ? "1" : "",
                  })
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
                  navegar({
                    q: query,
                    desde,
                    hasta: e.target.value,
                    almacen_id: almacenId,
                    vendedor_id: vendedorId,
                    pendientes: pendientes ? "1" : "",
                  })
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Almacén</label>
              {almacenFijoNombre ? (
                <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {almacenFijoNombre}
                </p>
              ) : (
                <select
                  value={almacenId}
                  onChange={(e) =>
                    navegar({
                      q: query,
                      desde,
                      hasta,
                      almacen_id: e.target.value,
                      vendedor_id: vendedorId,
                      pendientes: pendientes ? "1" : "",
                    })
                  }
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Vendedor</label>
              <select
                value={vendedorId}
                onChange={(e) =>
                  navegar({
                    q: query,
                    desde,
                    hasta,
                    almacen_id: almacenId,
                    vendedor_id: e.target.value,
                    pendientes: pendientes ? "1" : "",
                  })
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Todos</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={pendientes}
                onChange={(e) =>
                  navegar({
                    q: query,
                    desde,
                    hasta,
                    almacen_id: almacenId,
                    vendedor_id: vendedorId,
                    pendientes: e.target.checked ? "1" : "",
                  })
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
                  navegar({ q: "", desde: "", hasta: "", almacen_id: "", vendedor_id: "", pendientes: "" });
                }}
                className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
              >
                <X size={14} />
                Limpiar
              </button>
            )}
          </div>

          {pagosPorMetodo.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-emerald-200 text-emerald-900">
                  <tr>
                    <th className="px-4 py-2 font-bold">Resumen de lo cobrado</th>
                    <th className="px-4 py-2 text-right font-bold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagosPorMetodo.map((r) => (
                    <tr key={r.metodo} className="border-b border-emerald-100 last:border-0">
                      <td className="px-4 py-2 text-emerald-800">{r.label}</td>
                      <td className="px-4 py-2 text-right text-emerald-800">
                        {monedaResumen} {r.monto.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-emerald-200 font-semibold text-emerald-900">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right">
                      {monedaResumen} {totalPagosResumen.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

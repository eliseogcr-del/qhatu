"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

type Opcion = { id: string; nombre: string };

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
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const primerRender = useRef(true);

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
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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
  );
}

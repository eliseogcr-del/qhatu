"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ChevronDown, ChevronUp, Search, SlidersHorizontal, X } from "lucide-react";
import ProductoCombobox from "./ProductoCombobox";

type Opcion = { id: string; nombre: string };

export default function VentasProductosFiltroForm({
  q,
  desde,
  hasta,
  productoId,
  almacenId,
  productos,
  almacenes,
  almacenFijoNombre,
  hayFiltros,
}: {
  q: string;
  desde: string;
  hasta: string;
  productoId: string;
  almacenId: string;
  productos: Opcion[];
  almacenes: Opcion[];
  // Un vendedor tiene almacén fijo — se muestra como texto, no como select.
  almacenFijoNombre: string | null;
  hayFiltros: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const primerRender = useRef(true);
  const [abierto, setAbierto] = useState(!hayFiltros);

  const navegar = (params: {
    q: string;
    desde: string;
    hasta: string;
    producto_id: string;
    almacen_id: string;
  }) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set("q", params.q);
    // desde/hasta: se mandan siempre (incluso vacíos) para distinguir
    // "sin filtro explícito" (usa el día de hoy por defecto) de
    // "el usuario los vació a propósito" — igual que en Ventas y Kardex.
    usp.set("desde", params.desde);
    usp.set("hasta", params.hasta);
    if (params.producto_id) usp.set("producto_id", params.producto_id);
    if (params.almacen_id) usp.set("almacen_id", params.almacen_id);
    router.push(`${pathname}?${usp.toString()}`);
  };

  // Búsqueda por nombre de cliente: se espera una pausa al escribir antes
  // de filtrar, igual que en el listado de Ventas.
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      navegar({ q: query, desde, hasta, producto_id: productoId, almacen_id: almacenId });
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
      <div className="min-w-[180px] flex-1">
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
      <div className="min-w-[180px] flex-1">
        <label className="mb-1 block text-sm font-medium text-gray-700">Producto</label>
        <ProductoCombobox
          productos={productos}
          value={productoId}
          onChange={(producto_id) =>
            navegar({ q: query, desde, hasta, producto_id, almacen_id: almacenId })
          }
          placeholder="Todos"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
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
              producto_id: productoId,
              almacen_id: almacenId,
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
              producto_id: productoId,
              almacen_id: almacenId,
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
                producto_id: productoId,
                almacen_id: e.target.value,
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
      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            navegar({ q: "", desde: "", hasta: "", producto_id: "", almacen_id: "" });
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

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

type Opcion = { value: string; label: string };

export default function CobranzasFiltroForm({
  q,
  desde,
  hasta,
  metodoPago,
  tipoPago,
  estado,
  opcionesMetodoPago,
  hayFiltros,
}: {
  q: string;
  desde: string;
  hasta: string;
  metodoPago: string;
  tipoPago: string;
  estado: string;
  opcionesMetodoPago: Opcion[];
  hayFiltros: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(q);
  const primerRender = useRef(true);

  const navegar = (params: {
    q: string;
    desde: string;
    hasta: string;
    metodo_pago: string;
    tipo_pago: string;
    estado: string;
  }) => {
    const usp = new URLSearchParams();
    if (params.q) usp.set("q", params.q);
    if (params.desde) usp.set("desde", params.desde);
    if (params.hasta) usp.set("hasta", params.hasta);
    if (params.metodo_pago) usp.set("metodo_pago", params.metodo_pago);
    if (params.tipo_pago) usp.set("tipo_pago", params.tipo_pago);
    if (params.estado) usp.set("estado", params.estado);
    router.push(`${pathname}?${usp.toString()}`);
  };

  // Búsqueda por cliente: espera una pausa al escribir antes de filtrar;
  // el resto de filtros navega al toque, sin botón "Filtrar".
  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      navegar({ q: query, desde, hasta, metodo_pago: metodoPago, tipo_pago: tipoPago, estado });
    }, 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
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
            className={`${inputClass} pl-9`}
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
              metodo_pago: metodoPago,
              tipo_pago: tipoPago,
              estado,
            })
          }
          className={inputClass}
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
              metodo_pago: metodoPago,
              tipo_pago: tipoPago,
              estado,
            })
          }
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Método de pago</label>
        <select
          value={metodoPago}
          onChange={(e) =>
            navegar({
              q: query,
              desde,
              hasta,
              metodo_pago: e.target.value,
              tipo_pago: tipoPago,
              estado,
            })
          }
          className={inputClass}
        >
          <option value="">Todos</option>
          {opcionesMetodoPago.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Tipo de pago</label>
        <select
          value={tipoPago}
          onChange={(e) =>
            navegar({
              q: query,
              desde,
              hasta,
              metodo_pago: metodoPago,
              tipo_pago: e.target.value,
              estado,
            })
          }
          className={inputClass}
        >
          <option value="">Todos</option>
          <option value="anticipo">Anticipo</option>
          <option value="pago">Pago</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
        <select
          value={estado}
          onChange={(e) =>
            navegar({
              q: query,
              desde,
              hasta,
              metodo_pago: metodoPago,
              tipo_pago: tipoPago,
              estado: e.target.value,
            })
          }
          className={inputClass}
        >
          <option value="">Todos</option>
          <option value="activa">Activa</option>
          <option value="anulada">Anulada</option>
        </select>
      </div>
      {hayFiltros && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            navegar({ q: "", desde: "", hasta: "", metodo_pago: "", tipo_pago: "", estado: "" });
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

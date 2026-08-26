"use client";

import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";

type Opcion = { id: string; nombre: string };

export default function KardexFiltroForm({
  desde,
  hasta,
  productoId,
  almacenId,
  productos,
  almacenes,
  almacenFijoNombre,
  hayFiltros,
}: {
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

  const navegar = (params: {
    desde: string;
    hasta: string;
    producto_id: string;
    almacen_id: string;
  }) => {
    const usp = new URLSearchParams();
    // desde/hasta: se mandan siempre (incluso vacíos) para distinguir
    // "sin filtro explícito" (usa el día de hoy por defecto) de
    // "el usuario los vació a propósito" — igual que antes con el form GET.
    usp.set("desde", params.desde);
    usp.set("hasta", params.hasta);
    if (params.producto_id) usp.set("producto_id", params.producto_id);
    if (params.almacen_id) usp.set("almacen_id", params.almacen_id);
    router.push(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="min-w-[200px] flex-1">
        <label className="mb-1 block text-sm font-medium text-gray-700">Producto</label>
        <select
          value={productoId}
          onChange={(e) =>
            navegar({ desde, hasta, producto_id: e.target.value, almacen_id: almacenId })
          }
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
          onChange={(e) =>
            navegar({ desde: e.target.value, hasta, producto_id: productoId, almacen_id: almacenId })
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
            navegar({ desde, hasta: e.target.value, producto_id: productoId, almacen_id: almacenId })
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
              navegar({ desde, hasta, producto_id: productoId, almacen_id: e.target.value })
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
          onClick={() => navegar({ desde: "", hasta: "", producto_id: "", almacen_id: "" })}
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
        >
          <X size={14} />
          Limpiar
        </button>
      )}
    </div>
  );
}

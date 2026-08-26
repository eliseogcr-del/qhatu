"use client";

import { useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";

type Opcion = { id: string; nombre: string };

export default function InventarioFiltroForm({
  productoId,
  almacenId,
  bajoMinimo,
  sobreMaximo,
  conStock,
  productos,
  almacenes,
  almacenFijoNombre,
  hayFiltros,
}: {
  productoId: string;
  almacenId: string;
  bajoMinimo: boolean;
  sobreMaximo: boolean;
  conStock: boolean;
  productos: Opcion[];
  almacenes: Opcion[];
  // Un vendedor tiene almacén fijo — se muestra como texto, no como select.
  almacenFijoNombre: string | null;
  hayFiltros: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const navegar = (params: {
    producto_id: string;
    almacen_id: string;
    bajo_minimo: string;
    sobre_maximo: string;
    con_stock: string;
  }) => {
    const usp = new URLSearchParams();
    if (params.producto_id) usp.set("producto_id", params.producto_id);
    if (params.almacen_id) usp.set("almacen_id", params.almacen_id);
    if (params.bajo_minimo) usp.set("bajo_minimo", params.bajo_minimo);
    if (params.sobre_maximo) usp.set("sobre_maximo", params.sobre_maximo);
    if (params.con_stock) usp.set("con_stock", params.con_stock);
    router.push(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Producto</label>
        <select
          value={productoId}
          onChange={(e) =>
            navegar({
              producto_id: e.target.value,
              almacen_id: almacenId,
              bajo_minimo: bajoMinimo ? "1" : "",
              sobre_maximo: sobreMaximo ? "1" : "",
              con_stock: conStock ? "1" : "",
            })
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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
                producto_id: productoId,
                almacen_id: e.target.value,
                bajo_minimo: bajoMinimo ? "1" : "",
                sobre_maximo: sobreMaximo ? "1" : "",
                con_stock: conStock ? "1" : "",
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
      <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={bajoMinimo}
          onChange={(e) =>
            navegar({
              producto_id: productoId,
              almacen_id: almacenId,
              bajo_minimo: e.target.checked ? "1" : "",
              sobre_maximo: sobreMaximo ? "1" : "",
              con_stock: conStock ? "1" : "",
            })
          }
          className="h-4 w-4 rounded border-gray-300"
        />
        Bajo mínimo
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={sobreMaximo}
          onChange={(e) =>
            navegar({
              producto_id: productoId,
              almacen_id: almacenId,
              bajo_minimo: bajoMinimo ? "1" : "",
              sobre_maximo: e.target.checked ? "1" : "",
              con_stock: conStock ? "1" : "",
            })
          }
          className="h-4 w-4 rounded border-gray-300"
        />
        Sobre máximo
      </label>
      <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={conStock}
          onChange={(e) =>
            navegar({
              producto_id: productoId,
              almacen_id: almacenId,
              bajo_minimo: bajoMinimo ? "1" : "",
              sobre_maximo: sobreMaximo ? "1" : "",
              con_stock: e.target.checked ? "1" : "",
            })
          }
          className="h-4 w-4 rounded border-gray-300"
        />
        Con stock (mayor a 0)
      </label>
      {hayFiltros && (
        <button
          type="button"
          onClick={() =>
            navegar({
              producto_id: "",
              almacen_id: "",
              bajo_minimo: "",
              sobre_maximo: "",
              con_stock: "",
            })
          }
          className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
        >
          <X size={14} />
          Limpiar
        </button>
      )}
    </div>
  );
}

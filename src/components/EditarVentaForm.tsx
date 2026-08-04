"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import SubmitButton from "./SubmitButton";

type Producto = { id: string; nombre: string; precio_venta: number };

type Linea = {
  key: string;
  linea_id: string | null;
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
  precio_unitario: number;
  esNueva: boolean;
};

let nextKey = 0;
function keyFor() {
  nextKey += 1;
  return `n${nextKey}`;
}

export default function EditarVentaForm({
  action,
  error,
  ventaId,
  lineasIniciales,
  productos,
  cobrado,
  moneda,
}: {
  action: (formData: FormData) => void;
  error?: string;
  ventaId: string;
  lineasIniciales: {
    id: string;
    producto_id: string;
    producto_nombre: string;
    cantidad_entregada: number;
    precio_unitario: number;
  }[];
  productos: Producto[];
  cobrado: number;
  moneda: string;
}) {
  const [lineas, setLineas] = useState<Linea[]>(
    lineasIniciales.map((l) => ({
      key: keyFor(),
      linea_id: l.id,
      producto_id: l.producto_id,
      producto_nombre: l.producto_nombre,
      cantidad: l.cantidad_entregada,
      precio_unitario: l.precio_unitario,
      esNueva: false,
    })),
  );

  const actualizarLinea = (key: string, patch: Partial<Linea>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const agregarLinea = () => {
    setLineas((prev) => [
      ...prev,
      {
        key: keyFor(),
        linea_id: null,
        producto_id: "",
        producto_nombre: "",
        cantidad: 1,
        precio_unitario: 0,
        esNueva: true,
      },
    ]);
  };

  const quitarLinea = (key: string) => {
    setLineas((prev) => prev.filter((l) => l.key !== key));
  };

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0);
  const totalMenorQueCobrado = total < cobrado;

  return (
    <form action={action} className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <input type="hidden" name="venta_id" value={ventaId} />

      <div className="space-y-3">
        {lineas.map((linea) => (
          <div
            key={linea.key}
            className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_120px_140px_140px_auto]"
          >
            <input type="hidden" name="linea_id[]" value={linea.linea_id ?? ""} />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Producto
              </label>
              {linea.esNueva ? (
                <select
                  name="producto_id[]"
                  value={linea.producto_id}
                  onChange={(e) => {
                    const producto = productos.find((p) => p.id === e.target.value);
                    actualizarLinea(linea.key, {
                      producto_id: e.target.value,
                      precio_unitario: producto?.precio_venta ?? linea.precio_unitario,
                    });
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Selecciona un producto</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input type="hidden" name="producto_id[]" value={linea.producto_id} />
                  <input
                    disabled
                    value={linea.producto_nombre}
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                  />
                </>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Cantidad
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="cantidad[]"
                value={linea.cantidad}
                onChange={(e) =>
                  actualizarLinea(linea.key, { cantidad: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Precio unitario
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="precio_unitario[]"
                value={linea.precio_unitario}
                onChange={(e) =>
                  actualizarLinea(linea.key, {
                    precio_unitario: Number(e.target.value),
                  })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Subtotal
              </label>
              <input
                disabled
                value={(linea.cantidad * linea.precio_unitario).toFixed(2)}
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
              />
            </div>

            <button
              type="button"
              onClick={() => quitarLinea(linea.key)}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm text-gray-500 hover:bg-gray-100"
            >
              <Trash2 size={14} />
              Quitar
            </button>
          </div>
        ))}

        {lineas.length === 0 && (
          <p className="text-sm text-gray-400">
            No quedan productos en la venta — agrega al menos uno para guardar.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={agregarLinea}
        className="flex items-center gap-1.5 text-sm font-medium text-gray-700 underline hover:text-gray-900"
      >
        <Plus size={14} />
        Agregar producto
      </button>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
        <p className="text-gray-600">
          Ya cobrado (no editable): {moneda} {cobrado.toFixed(2)}
        </p>
        <p className="mt-1 text-right font-semibold text-gray-900">
          Nuevo total: {moneda} {total.toFixed(2)}
        </p>
        {totalMenorQueCobrado && (
          <p className="mt-1 text-red-600">
            El nuevo total no puede ser menor a lo ya cobrado.
          </p>
        )}
      </div>

      <SubmitButton pendingLabel="Guardando cambios...">
        Guardar cambios
      </SubmitButton>
    </form>
  );
}

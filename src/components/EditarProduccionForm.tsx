"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import SubmitButton from "./SubmitButton";
import ProductoCombobox from "./ProductoCombobox";

type Producto = { id: string; nombre: string };

type Linea = {
  key: string;
  detalle_id: string | null;
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

let nextKey = 0;
function keyFor() {
  nextKey += 1;
  return `n${nextKey}`;
}

export default function EditarProduccionForm({
  action,
  error,
  produccionId,
  almacenNombre,
  lineasIniciales,
  productos,
}: {
  action: (formData: FormData) => void;
  error?: string;
  produccionId: string;
  almacenNombre: string;
  lineasIniciales: {
    id: string;
    producto_id: string;
    producto_nombre: string;
    cantidad: number;
  }[];
  productos: Producto[];
}) {
  const [lineas, setLineas] = useState<Linea[]>(
    lineasIniciales.map((l) => ({
      key: keyFor(),
      detalle_id: l.id,
      producto_id: l.producto_id,
      producto_nombre: l.producto_nombre,
      cantidad: l.cantidad,
    })),
  );
  const [aviso, setAviso] = useState<string | null>(null);

  const actualizarLinea = (key: string, patch: Partial<Linea>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const seleccionarProducto = (key: string, productoId: string) => {
    const yaExiste =
      productoId !== "" && lineas.some((l) => l.key !== key && l.producto_id === productoId);

    if (yaExiste) {
      const producto = productos.find((p) => p.id === productoId);
      setAviso(
        `"${producto?.nombre ?? "Este producto"}" ya está en la lista. Ajusta la cantidad en esa línea en vez de agregarlo de nuevo.`,
      );
      return;
    }

    setAviso(null);
    actualizarLinea(key, { producto_id: productoId });
  };

  const agregarLinea = () => {
    setLineas((prev) => [
      ...prev,
      { key: keyFor(), detalle_id: null, producto_id: "", producto_nombre: "", cantidad: 1 },
    ]);
  };

  const quitarLinea = (key: string) => {
    setLineas((prev) => prev.filter((l) => l.key !== key));
  };

  const tieneDuplicados = (() => {
    const vistos = new Set<string>();
    for (const l of lineas) {
      if (!l.producto_id) continue;
      if (vistos.has(l.producto_id)) return true;
      vistos.add(l.producto_id);
    }
    return false;
  })();

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (tieneDuplicados) {
          e.preventDefault();
          setAviso("Hay un producto repetido. Quita la línea duplicada antes de guardar.");
        }
      }}
      className="space-y-6"
    >
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {aviso && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {aviso}
        </p>
      )}

      <input type="hidden" name="produccion_id" value={produccionId} />

      <p className="text-sm text-gray-500">
        Almacén: <span className="font-medium text-gray-900">{almacenNombre}</span>
      </p>

      <div className="space-y-3">
        {lineas.map((linea) => (
          <div
            key={linea.key}
            className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_140px_auto]"
          >
            <input type="hidden" name="detalle_id[]" value={linea.detalle_id ?? ""} />
            <Field label="Producto">
              <ProductoCombobox
                productos={productos}
                value={linea.producto_id}
                onChange={(productoId) => seleccionarProducto(linea.key, productoId)}
                className={inputClass}
              />
            </Field>
            <Field label="Cantidad">
              <input
                type="number"
                step="0.01"
                min="0.01"
                name="cantidad[]"
                value={linea.cantidad || ""}
                onChange={(e) =>
                  actualizarLinea(linea.key, { cantidad: Number(e.target.value) })
                }
                className={inputClass}
              />
            </Field>
            <button
              type="button"
              onClick={() => quitarLinea(linea.key)}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-500 hover:bg-gray-100"
            >
              <Trash2 size={14} />
              Quitar
            </button>
          </div>
        ))}

        {lineas.length === 0 && (
          <p className="text-sm text-gray-400">
            No quedan productos en esta producción — agrega al menos uno para guardar.
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

      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
        Cualquier cambio de cantidad o producto corrige el inventario y el
        kardex de inmediato, y queda registrado en auditoría.
      </p>

      <SubmitButton pendingLabel="Guardando cambios...">Guardar cambios</SubmitButton>
    </form>
  );
}

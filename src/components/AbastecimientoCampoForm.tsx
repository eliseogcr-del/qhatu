"use client";

import { useState } from "react";
import { Plus, Trash2, Send } from "lucide-react";
import SubmitButton from "./SubmitButton";

type Almacen = { id: string; nombre: string };
type Proveedor = { id: string; nombre: string };
type Producto = { id: string; nombre: string };

type Linea = {
  key: string;
  producto_id: string;
  cantidad: number;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

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
function newLinea(): Linea {
  nextKey += 1;
  return { key: `l${nextKey}`, producto_id: "", cantidad: 1 };
}

export default function AbastecimientoCampoForm({
  action,
  error,
  proveedores,
  productos,
  almacenes,
}: {
  action: (formData: FormData) => void;
  error?: string;
  proveedores: Proveedor[];
  productos: Producto[];
  // Solo se pasa (con al menos un local) cuando quien registra es admin
  // — un vendedor tiene su almacén fijo y el servidor lo asigna solo.
  almacenes?: Almacen[];
}) {
  const [lineas, setLineas] = useState<Linea[]>([newLinea()]);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);

  const updateLinea = (key: string, patch: Partial<Linea>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const seleccionarProducto = (key: string, productoId: string) => {
    const yaExiste =
      productoId !== "" && lineas.some((l) => l.key !== key && l.producto_id === productoId);

    if (yaExiste) {
      const producto = productos.find((p) => p.id === productoId);
      setAvisoDuplicado(
        `"${producto?.nombre ?? "Este producto"}" ya está en la lista. Ajusta la cantidad en esa línea en vez de agregarlo de nuevo.`,
      );
      return;
    }

    setAvisoDuplicado(null);
    updateLinea(key, { producto_id: productoId });
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
          setAvisoDuplicado("Hay un producto repetido. Quita la línea duplicada antes de guardar.");
        }
      }}
      className="space-y-8"
    >
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {avisoDuplicado && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          {avisoDuplicado}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Datos del abastecimiento
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Proveedor (opcional)">
            <select name="proveedor_id" defaultValue="" className={inputClass}>
              <option value="">Sin especificar</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Field>
          {almacenes && almacenes.length > 0 && (
            <Field label="Almacén / Local">
              <select name="almacen_id" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Selecciona un local
                </option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <Field label="Nota (opcional)">
          <input
            name="nota"
            placeholder="Ej. recogido camino a Los Olivos..."
            className={inputClass}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Productos recogidos
        </h2>
        <p className="text-xs text-gray-400">
          Solo registra qué y cuánto — sin precios. El costo lo maneja
          administración cuando llegue la factura del proveedor.
        </p>

        <div className="space-y-3">
          {lineas.map((linea) => (
            <div
              key={linea.key}
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_140px_auto]"
            >
              <Field label="Producto">
                <select
                  name="producto_id[]"
                  value={linea.producto_id}
                  onChange={(e) => seleccionarProducto(linea.key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecciona un producto</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cantidad">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="cantidad[]"
                  value={linea.cantidad || ""}
                  onChange={(e) =>
                    updateLinea(linea.key, { cantidad: Number(e.target.value) })
                  }
                  className={inputClass}
                />
              </Field>
              <button
                type="button"
                onClick={() =>
                  setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== linea.key) : prev))
                }
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm text-gray-500 hover:bg-gray-100"
              >
                <Trash2 size={14} />
                Quitar
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setLineas((prev) => [...prev, newLinea()])}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 underline hover:text-gray-900"
        >
          <Plus size={14} />
          Agregar producto
        </button>
      </section>

      <SubmitButton icon={<Send size={16} />} pendingLabel="Registrando...">
        Registrar abastecimiento
      </SubmitButton>
    </form>
  );
}

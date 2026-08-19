"use client";

import { useState } from "react";
import SubmitButton from "./SubmitButton";
import ClienteCombobox from "./ClienteCombobox";

type Cliente = { id: string; nombre: string };
type Producto = {
  id: string;
  nombre: string;
  precio_venta: number;
  precio_venta_moneda: string;
  control_inventario: boolean;
};

type Linea = {
  key: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children}
    </div>
  );
}

let nextKey = 0;
function newLinea(): Linea {
  nextKey += 1;
  return { key: `l${nextKey}`, producto_id: "", cantidad: 1, precio_unitario: 0 };
}

export default function VentaDirectaForm({
  action,
  error,
  clientes,
  productos,
  almacenes,
  stockPorAlmacen,
  almacenSesion,
}: {
  action: (formData: FormData) => void;
  error?: string;
  clientes: Cliente[];
  productos: Producto[];
  // Solo se pasa (con al menos un local) cuando quien registra es admin
  // — un vendedor tiene su almacén fijo y el servidor lo asigna solo.
  almacenes?: { id: string; nombre: string }[];
  // Stock por producto+almacén, clave `${productoId}::${almacenId}`, para
  // solo ofrecer lo que ese almacén realmente tiene (ej. lo que un
  // vendedor de campo lleva cargado en su almacén móvil).
  stockPorAlmacen: Record<string, number>;
  // Almacén fijo del usuario (vendedor); null/undefined si es admin.
  almacenSesion?: string | null;
}) {
  const [lineas, setLineas] = useState<Linea[]>([newLinea()]);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState(almacenSesion ?? "");

  const productosDisponibles = productos.filter((p) => {
    if (!p.control_inventario) return true;
    if (!almacenSeleccionado) return true;
    return (stockPorAlmacen[`${p.id}::${almacenSeleccionado}`] ?? 0) > 0;
  });

  const updateLinea = (key: string, patch: Partial<Linea>) => {
    setLineas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  const seleccionarProducto = (key: string, productoId: string) => {
    const yaExiste =
      productoId !== "" &&
      lineas.some((l) => l.key !== key && l.producto_id === productoId);

    if (yaExiste) {
      const producto = productos.find((p) => p.id === productoId);
      setAvisoDuplicado(
        `"${producto?.nombre ?? "Este producto"}" ya está en la venta. Ajusta la cantidad en esa línea en vez de agregarlo de nuevo.`,
      );
      return;
    }

    setAvisoDuplicado(null);
    const producto = productos.find((p) => p.id === productoId);
    updateLinea(key, {
      producto_id: productoId,
      precio_unitario: producto?.precio_venta ?? 0,
    });
  };

  const total = lineas.reduce(
    (acc, l) => acc + l.cantidad * l.precio_unitario,
    0,
  );

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
          setAvisoDuplicado(
            "Hay un producto repetido en la venta. Quita la línea duplicada antes de guardar.",
          );
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
          Datos de la venta
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente">
            <ClienteCombobox clientes={clientes} />
          </Field>
          <Field label="Moneda">
            <select name="moneda" defaultValue="PEN" className={inputClass}>
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </Field>
          <Field label="Tipo de cambio aplicado">
            <input
              type="number"
              step="0.0001"
              name="tipo_cambio_aplicado"
              required
              defaultValue={1}
              className={inputClass}
            />
          </Field>
          {almacenes && almacenes.length > 0 && (
            <Field label="Almacén / Local">
              <select
                name="almacen_id"
                required
                value={almacenSeleccionado}
                onChange={(e) => {
                  setAlmacenSeleccionado(e.target.value);
                  setLineas((prev) =>
                    prev.map((l) => ({ ...l, producto_id: "", precio_unitario: 0 })),
                  );
                }}
                className={inputClass}
              >
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
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Productos vendidos
        </h2>
        {almacenSeleccionado && productosDisponibles.length === 0 && (
          <p className="text-sm text-amber-600">
            Ese almacén no tiene productos con stock disponible en este momento.
          </p>
        )}

        <div className="space-y-3">
          {lineas.map((linea) => {
            const productoElegido = productos.find((p) => p.id === linea.producto_id);
            const stockDisponible =
              productoElegido?.control_inventario && almacenSeleccionado
                ? stockPorAlmacen[`${linea.producto_id}::${almacenSeleccionado}`] ?? 0
                : null;

            return (
            <div
              key={linea.key}
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_120px_140px_140px_auto]"
            >
              <Field label="Producto">
                <select
                  name="producto_id[]"
                  value={linea.producto_id}
                  onChange={(e) => seleccionarProducto(linea.key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecciona un producto</option>
                  {productosDisponibles.map((p) => (
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
                  min="0.01"
                  max={stockDisponible ?? undefined}
                  name="cantidad[]"
                  value={linea.cantidad || ""}
                  onChange={(e) =>
                    updateLinea(linea.key, {
                      cantidad: Number(e.target.value),
                    })
                  }
                  className={inputClass}
                />
                {stockDisponible !== null && (
                  <p
                    className={`mt-1 text-xs ${linea.cantidad > stockDisponible ? "text-red-600" : "text-gray-400"}`}
                  >
                    Disponible: {stockDisponible}
                  </p>
                )}
              </Field>
              <Field label="Precio unitario">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="precio_unitario[]"
                  value={linea.precio_unitario || ""}
                  onChange={(e) =>
                    updateLinea(linea.key, {
                      precio_unitario: Number(e.target.value),
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Subtotal">
                <input
                  disabled
                  value={(linea.cantidad * linea.precio_unitario).toFixed(2)}
                  className={`${inputClass} bg-gray-50 text-gray-500`}
                />
              </Field>
              <button
                type="button"
                onClick={() =>
                  setLineas((prev) =>
                    prev.length > 1
                      ? prev.filter((l) => l.key !== linea.key)
                      : prev,
                  )
                }
                className="h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-500 hover:bg-gray-100"
              >
                Quitar
              </button>
            </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setLineas((prev) => [...prev, newLinea()])}
          className="text-sm font-medium text-gray-700 underline hover:text-gray-900"
        >
          + Agregar producto
        </button>

        <p className="text-right text-sm font-medium text-gray-900">
          Total: {total.toFixed(2)}
        </p>
      </section>

      <SubmitButton pendingLabel="Registrando venta...">
        Registrar venta directa
      </SubmitButton>
    </form>
  );
}

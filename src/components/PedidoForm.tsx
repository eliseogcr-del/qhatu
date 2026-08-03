"use client";

import { useState } from "react";

type Cliente = { id: string; nombre: string };
type Producto = {
  id: string;
  nombre: string;
  precio_venta: number;
  precio_venta_moneda: string;
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

export default function PedidoForm({
  action,
  error,
  clientes,
  productos,
}: {
  action: (formData: FormData) => void;
  error?: string;
  clientes: Cliente[];
  productos: Producto[];
}) {
  const [lineas, setLineas] = useState<Linea[]>([newLinea()]);

  const updateLinea = (key: string, patch: Partial<Linea>) => {
    setLineas((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  };

  const total = lineas.reduce(
    (acc, l) => acc + l.cantidad * l.precio_unitario,
    0,
  );

  return (
    <form action={action} className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Datos del pedido
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente">
            <select name="cliente_id" required className={inputClass}>
              <option value="">Selecciona un cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Canal del pedido">
            <select name="canal_pedido" defaultValue="telefono" className={inputClass}>
              <option value="telefono">Teléfono</option>
              <option value="whatsapp_texto">WhatsApp (texto)</option>
              <option value="whatsapp_imagen">WhatsApp (imagen)</option>
              <option value="otro">Otro</option>
            </select>
          </Field>
          <Field label="Fecha de entrega requerida">
            <input
              type="date"
              name="fecha_entrega_requerida"
              className={inputClass}
            />
          </Field>
          <Field label="Moneda">
            <select name="moneda" defaultValue="PEN" className={inputClass}>
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Productos pedidos
        </h2>

        <div className="space-y-3">
          {lineas.map((linea) => (
            <div
              key={linea.key}
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_120px_140px_140px_auto]"
            >
              <Field label="Producto">
                <select
                  name="producto_id[]"
                  value={linea.producto_id}
                  onChange={(e) => {
                    const producto = productos.find(
                      (p) => p.id === e.target.value,
                    );
                    updateLinea(linea.key, {
                      producto_id: e.target.value,
                      precio_unitario:
                        producto?.precio_venta ?? linea.precio_unitario,
                    });
                  }}
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
                  value={linea.cantidad}
                  onChange={(e) =>
                    updateLinea(linea.key, {
                      cantidad: Number(e.target.value),
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Precio unitario">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  name="precio_unitario[]"
                  value={linea.precio_unitario}
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
          ))}
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

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Adjuntos
        </h2>
        <Field label="Fotos o capturas del pedido (WhatsApp, etc.)">
          <input
            type="file"
            name="adjuntos"
            multiple
            accept="image/*,application/pdf"
            className="block w-full text-sm text-gray-600"
          />
        </Field>
      </section>

      <button
        type="submit"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Crear pedido
      </button>
    </form>
  );
}

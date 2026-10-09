"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Send } from "lucide-react";
import SubmitButton from "./SubmitButton";
import ClienteCombobox from "./ClienteCombobox";
import ProductoCombobox from "./ProductoCombobox";

type Producto = { id: string; nombre: string };
type Anticipo = {
  id: string;
  etiqueta: string; // "Factura F001-123 — Cliente X (01/10/2026) — S/ 600.00"
};

type Linea = {
  key: string;
  productoId: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
  return { key: `l${nextKey}`, productoId: "", descripcion: "", cantidad: 1, precioUnitario: 0 };
}

export default function ComprobanteLibreForm({
  action,
  error,
  clientes,
  productos,
  anticipos,
  hoy,
}: {
  action: (formData: FormData) => void;
  error?: string;
  clientes: { id: string; nombre: string }[];
  productos: Producto[];
  anticipos: Anticipo[];
  hoy: string;
}) {
  const [tipoComprobante, setTipoComprobante] = useState("2");
  const [tipoEmision, setTipoEmision] = useState<"" | "anticipo" | "saldo">("");
  const [comprobanteAnticipoId, setComprobanteAnticipoId] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([newLinea()]);

  const updateLinea = (key: string, patch: Partial<Linea>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  // Precio unitario siempre con IGV incluido (igual que en el resto del
  // sistema) — el IGV se extrae del total, nunca se suma encima.
  const total = useMemo(
    () => lineas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0),
    [lineas],
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
          Datos del comprobante
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Cliente">
            <ClienteCombobox clientes={clientes} />
          </Field>
          <Field label="Fecha de emisión">
            <input type="date" name="fecha_emision" defaultValue={hoy} required className={inputClass} />
          </Field>
          <Field label="Tipo de documento">
            <select
              name="tipo_comprobante"
              value={tipoComprobante}
              onChange={(e) => setTipoComprobante(e.target.value)}
              className={inputClass}
            >
              <option value="2">Boleta</option>
              <option value="1">Factura (requiere cliente con RUC)</option>
            </select>
          </Field>
          <Field label="Tipo de emisión">
            <select
              name="tipo_emision"
              value={tipoEmision}
              onChange={(e) => setTipoEmision(e.target.value as "" | "anticipo" | "saldo")}
              className={inputClass}
            >
              <option value="">Normal</option>
              <option value="anticipo">Anticipo</option>
              <option value="saldo">Saldo (regulariza un anticipo)</option>
            </select>
          </Field>
        </div>

        {tipoEmision === "saldo" && (
          <Field label="Anticipo que regulariza">
            <select
              name="comprobante_anticipo_id"
              value={comprobanteAnticipoId}
              onChange={(e) => setComprobanteAnticipoId(e.target.value)}
              required
              className={inputClass}
            >
              <option value="">Selecciona el comprobante de anticipo...</option>
              {anticipos.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.etiqueta}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Se agrega automáticamente una línea de descuento con el monto de ese anticipo —
              no hace falta escribirla.
            </p>
          </Field>
        )}

        <Field label="Descripción (opcional)">
          <textarea name="descripcion" rows={2} className={inputClass} />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Líneas</h2>

        <div className="space-y-3">
          {lineas.map((linea) => (
            <div
              key={linea.key}
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_100px_140px_140px_auto]"
            >
              <Field label="Producto (opcional)">
                <ProductoCombobox
                  productos={productos}
                  value={linea.productoId}
                  onChange={(productoId) => {
                    const producto = productos.find((p) => p.id === productoId);
                    updateLinea(linea.key, {
                      productoId,
                      descripcion: producto?.nombre ?? linea.descripcion,
                    });
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="Descripción">
                <input
                  name="descripcion_linea[]"
                  value={linea.descripcion}
                  onChange={(e) => updateLinea(linea.key, { descripcion: e.target.value })}
                  placeholder='Ej. "Anticipo 40% recibido"'
                  required
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
                  onChange={(e) => updateLinea(linea.key, { cantidad: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
              <Field label="Precio unitario">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  name="precio_unitario[]"
                  value={linea.precioUnitario || ""}
                  onChange={(e) => updateLinea(linea.key, { precioUnitario: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
              <Field label="Importe">
                <input
                  disabled
                  value={(linea.cantidad * linea.precioUnitario).toFixed(2)}
                  className={`${inputClass} bg-gray-50 text-gray-500`}
                />
              </Field>
              <button
                type="button"
                onClick={() =>
                  setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== linea.key) : prev))
                }
                className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-500 hover:bg-gray-100"
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
          Agregar línea
        </button>
      </section>

      <div className="ml-auto w-56 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
        <div className="flex justify-between font-semibold">
          <span className="text-gray-900">Total (líneas, IGV incl.)</span>
          <span className="text-gray-900">{total.toFixed(2)}</span>
        </div>
        {tipoEmision === "saldo" && (
          <p className="text-xs text-gray-400">
            El descuento del anticipo se resta aparte, al emitir.
          </p>
        )}
      </div>

      <SubmitButton icon={<Send size={16} />} pendingLabel="Emitiendo...">
        Emitir comprobante
      </SubmitButton>
    </form>
  );
}

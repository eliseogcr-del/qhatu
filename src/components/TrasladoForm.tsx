"use client";

import { useState } from "react";
import { Plus, Trash2, Send } from "lucide-react";
import SubmitButton from "./SubmitButton";
import ProductoCombobox from "./ProductoCombobox";

type Almacen = { id: string; nombre: string };
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

export default function TrasladoForm({
  action,
  error,
  almacenes,
  productos,
  almacenSesion,
  stockPorAlmacen,
}: {
  action: (formData: FormData) => void;
  error?: string;
  almacenes: Almacen[];
  productos: Producto[];
  // Si viene con valor (vendedor), el origen queda fijo a su propio
  // almacén y el destino no puede ser él mismo — un vendedor solo puede
  // enviar mercadería desde su almacén, nunca recibir hacia él (eso lo
  // controla admin/logística). Si es null/undefined (admin/logística),
  // ambos campos quedan libres.
  almacenSesion?: string | null;
  // Stock por producto+almacén, clave `${productoId}::${almacenId}`, para
  // mostrar cuánto hay disponible en el almacén de origen elegido.
  stockPorAlmacen: Record<string, number>;
}) {
  const [lineas, setLineas] = useState<Linea[]>([newLinea()]);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
  const [origenId, setOrigenId] = useState(almacenSesion ?? "");
  const [destinoId, setDestinoId] = useState("");
  const almacenPropio = almacenSesion
    ? almacenes.find((a) => a.id === almacenSesion)
    : null;
  const almacenesDestino = almacenSesion
    ? almacenes.filter((a) => a.id !== almacenSesion)
    : almacenes;
  const origenIdEfectivo = almacenSesion ?? origenId;

  const updateLinea = (key: string, patch: Partial<Linea>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const seleccionarProducto = (key: string, productoId: string) => {
    const yaExiste =
      productoId !== "" && lineas.some((l) => l.key !== key && l.producto_id === productoId);

    if (yaExiste) {
      const producto = productos.find((p) => p.id === productoId);
      setAvisoDuplicado(
        `"${producto?.nombre ?? "Este producto"}" ya está en el traslado. Ajusta la cantidad en esa línea en vez de agregarlo de nuevo.`,
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
          return;
        }
        if (origenId && destinoId && origenId === destinoId) {
          e.preventDefault();
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
      {origenId && destinoId && origenId === destinoId && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          El origen y el destino no pueden ser el mismo almacén.
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Datos del traslado
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Almacén de origen">
            {almacenSesion ? (
              <>
                <input
                  disabled
                  value={almacenPropio?.nombre ?? "Tu almacén"}
                  className={`${inputClass} bg-gray-50 text-gray-500`}
                />
                <input type="hidden" name="almacen_origen_id" value={almacenSesion} />
              </>
            ) : (
              <select
                name="almacen_origen_id"
                required
                value={origenId}
                onChange={(e) => setOrigenId(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecciona un almacén</option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Almacén de destino">
            <select
              name="almacen_destino_id"
              required
              value={destinoId}
              onChange={(e) => setDestinoId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecciona un almacén</option>
              {almacenesDestino.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
            {almacenSesion && (
              <p className="mt-1 text-xs text-gray-400">
                Solo puedes enviar mercadería desde tu almacén, no recibirla.
              </p>
            )}
          </Field>
        </div>
        <Field label="Nota (opcional)">
          <input
            name="nota"
            placeholder="Ej. carga para ruta del lunes, retorno de fin de ruta..."
            className={inputClass}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Productos a trasladar
        </h2>

        <div className="space-y-3">
          {lineas.map((linea) => {
            const stockDisponible =
              origenIdEfectivo && linea.producto_id
                ? stockPorAlmacen[`${linea.producto_id}::${origenIdEfectivo}`] ?? 0
                : null;

            return (
            <div
              key={linea.key}
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_140px_auto]"
            >
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
                  max={stockDisponible ?? undefined}
                  name="cantidad[]"
                  value={linea.cantidad || ""}
                  onChange={(e) =>
                    updateLinea(linea.key, { cantidad: Number(e.target.value) })
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
            );
          })}
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

      <SubmitButton icon={<Send size={16} />} pendingLabel="Registrando traslado...">
        Registrar traslado
      </SubmitButton>
    </form>
  );
}

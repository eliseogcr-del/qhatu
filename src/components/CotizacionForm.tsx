"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Lock } from "lucide-react";
import SubmitButton from "./SubmitButton";
import ClienteCombobox from "./ClienteCombobox";
import ProductoCombobox from "./ProductoCombobox";
import { consultarPrecioLinea } from "@/app/(app)/precios/actions";

type Producto = {
  id: string;
  nombre: string;
  unidad_medida_id: string | null;
};
type UnidadMedida = { id: string; descripcion: string; cantidad: number };

type Linea = {
  key: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  unidad_medida_id: string;
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
  return {
    key: `l${nextKey}`,
    producto_id: "",
    cantidad: 1,
    precio_unitario: 0,
    unidad_medida_id: "",
  };
}

export default function CotizacionForm({
  action,
  error,
  clientes,
  productos,
  unidadesMedida,
  porcentajeIgv,
  hoy,
  preciosBloqueados,
  almacenId,
}: {
  action: (formData: FormData) => void;
  error?: string;
  clientes: { id: string; nombre: string }[];
  productos: Producto[];
  unidadesMedida: UnidadMedida[];
  porcentajeIgv: number;
  hoy: string;
  preciosBloqueados: boolean;
  almacenId: string | null;
}) {
  const [tipoCliente, setTipoCliente] = useState<"registrado" | "prospecto">("registrado");
  const [clienteId, setClienteId] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([newLinea()]);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);

  const updateLinea = (key: string, patch: Partial<Linea>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  // Una cotización no tiene almacén propio — el canal (campo vs. digital)
  // se toma del almacén fijo del vendedor que la está creando, igual que
  // hará el servidor al guardar.
  const resolverPrecioLinea = async (
    key: string,
    productoId: string,
    unidadMedidaId: string,
  ) => {
    if (!productoId) return;
    const precio = await consultarPrecioLinea(
      tipoCliente === "registrado" && clienteId ? clienteId : null,
      productoId,
      unidadMedidaId || null,
      almacenId,
    );
    updateLinea(key, { precio_unitario: precio });
  };

  useEffect(() => {
    if (!preciosBloqueados) return;
    lineas.forEach((l) => {
      if (l.producto_id) resolverPrecioLinea(l.key, l.producto_id, l.unidad_medida_id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, tipoCliente, preciosBloqueados]);

  const seleccionarProducto = (key: string, productoId: string) => {
    const yaExiste =
      productoId !== "" && lineas.some((l) => l.key !== key && l.producto_id === productoId);

    if (yaExiste) {
      const producto = productos.find((p) => p.id === productoId);
      setAvisoDuplicado(
        `"${producto?.nombre ?? "Este producto"}" ya está en la cotización. Ajusta la cantidad en esa línea en vez de agregarlo de nuevo.`,
      );
      return;
    }

    setAvisoDuplicado(null);
    const producto = productos.find((p) => p.id === productoId);
    const unidadMedidaId = producto?.unidad_medida_id ?? "";
    updateLinea(key, {
      producto_id: productoId,
      unidad_medida_id: unidadMedidaId,
    });
    resolverPrecioLinea(key, productoId, unidadMedidaId);
  };

  const seleccionarUnidadMedida = (key: string, unidadMedidaId: string) => {
    updateLinea(key, { unidad_medida_id: unidadMedidaId });
    const linea = lineas.find((l) => l.key === key);
    if (preciosBloqueados && linea?.producto_id) {
      resolverPrecioLinea(key, linea.producto_id, unidadMedidaId);
    }
  };

  // El precio unitario ya incluye el impuesto (igual que en Nota de
  // venta/Boleta) — el impuesto se extrae del total, no se suma encima.
  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0);
  const subtotal = Math.round((total / (1 + porcentajeIgv / 100)) * 100) / 100;
  const impuestos = Math.round((total - subtotal) * 100) / 100;

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
            "Hay un producto repetido en la cotización. Quita la línea duplicada antes de guardar.",
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
          Cliente
        </h2>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={tipoCliente === "registrado"}
              onChange={() => setTipoCliente("registrado")}
            />
            Cliente registrado
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={tipoCliente === "prospecto"}
              onChange={() => setTipoCliente("prospecto")}
            />
            Prospecto (sin registrar)
          </label>
        </div>

        {tipoCliente === "registrado" ? (
          <Field label="Cliente">
            <ClienteCombobox clientes={clientes} onChange={setClienteId} />
          </Field>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre / Razón social">
              <input name="prospecto_nombre" required className={inputClass} />
            </Field>
            <Field label="RUC / DNI">
              <input name="prospecto_ruc" className={inputClass} />
            </Field>
            <Field label="Teléfono">
              <input name="prospecto_telefono" className={inputClass} />
            </Field>
            <Field label="Correo">
              <input type="email" name="prospecto_correo" className={inputClass} />
            </Field>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Datos de la cotización
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          Productos cotizados
        </h2>

        <div className="space-y-3">
          {lineas.map((linea) => {
            const unidadSeleccionada = unidadesMedida.find(
              (u) => u.id === linea.unidad_medida_id,
            );
            const factor = unidadSeleccionada?.cantidad ?? 1;
            const cantidadBase = linea.cantidad * factor;

            return (
              <div
                key={linea.key}
                className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_120px_150px_140px_140px_auto]"
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
                    name="cantidad[]"
                    value={linea.cantidad || ""}
                    onChange={(e) =>
                      updateLinea(linea.key, { cantidad: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                  {factor !== 1 && (
                    <p className="mt-1 text-xs text-gray-400">= {cantidadBase} unidades</p>
                  )}
                </Field>
                <Field label="Unidad de medida">
                  <select
                    name="unidad_medida_id[]"
                    value={linea.unidad_medida_id}
                    onChange={(e) => seleccionarUnidadMedida(linea.key, e.target.value)}
                    className={inputClass}
                  >
                    <option value="">—</option>
                    {unidadesMedida.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.descripcion}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Precio unitario">
                  {preciosBloqueados ? (
                    <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      <Lock size={12} className="shrink-0 text-gray-400" />
                      {linea.precio_unitario.toFixed(2)}
                      <input
                        type="hidden"
                        name="precio_unitario[]"
                        value={linea.precio_unitario}
                      />
                    </div>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      name="precio_unitario[]"
                      value={linea.precio_unitario || ""}
                      onChange={(e) =>
                        updateLinea(linea.key, { precio_unitario: Number(e.target.value) })
                      }
                      className={inputClass}
                    />
                  )}
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
                      prev.length > 1 ? prev.filter((l) => l.key !== linea.key) : prev,
                    )
                  }
                  className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-500 hover:bg-gray-100"
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

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Condiciones comerciales
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Oferta válido hasta">
            <input
              type="date"
              name="oferta_valida_hasta"
              defaultValue={hoy}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Fecha de entrega">
            <input
              type="date"
              name="fecha_entrega"
              defaultValue={hoy}
              required
              className={inputClass}
            />
          </Field>
          <Field label="Lugar de entrega">
            <input name="lugar_entrega" className={inputClass} />
          </Field>
        </div>
      </section>

      <div className="ml-auto w-56 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-gray-900">{subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Impuestos ({porcentajeIgv}%)</span>
          <span className="text-gray-900">{impuestos.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-gray-900">Total</span>
          <span className="text-gray-900">{total.toFixed(2)}</span>
        </div>
      </div>

      <SubmitButton icon={<Save size={16} />} pendingLabel="Creando cotización...">
        Crear cotización
      </SubmitButton>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { TIPOS_DEVOLUCION, TIPO_DEVOLUCION_LABEL } from "@/lib/devolucion-tipos";
import SubmitButton from "./SubmitButton";

type LineaPedido = {
  pedido_detalle_id: string;
  producto_nombre: string;
  cantidad_pedida: number;
  precio_unitario: number;
  unidad_medida_descripcion: string | null;
  factor: number;
};

type LineaVenta = LineaPedido & {
  cantidad_entregada: number;
  motivo: string;
  tipo_devolucion: string;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

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

export default function VentaForm({
  action,
  error,
  pedidoId,
  clienteNombre,
  monedaPedido,
  lineasPedido,
  preciosBloqueados,
}: {
  action: (formData: FormData) => void;
  error?: string;
  pedidoId: string;
  clienteNombre: string;
  monedaPedido: string;
  lineasPedido: LineaPedido[];
  // El precio viene fijado del pedido; esto solo controla si se puede
  // corregir a mano al momento de facturar.
  preciosBloqueados: boolean;
}) {
  const [lineas, setLineas] = useState<LineaVenta[]>(
    lineasPedido.map((l) => ({
      ...l,
      cantidad_entregada: l.cantidad_pedida,
      motivo: "",
      tipo_devolucion: "danado",
    })),
  );

  const [descuento, setDescuento] = useState(0);

  const updateLinea = (
    id: string,
    patch: Partial<LineaVenta>,
  ) => {
    setLineas((prev) =>
      prev.map((l) => (l.pedido_detalle_id === id ? { ...l, ...patch } : l)),
    );
  };

  const total = lineas.reduce(
    (acc, l) => acc + l.cantidad_entregada * l.precio_unitario,
    0,
  );
  const netoAPagar = Math.max(total - descuento, 0);

  return (
    <form action={action} className="space-y-8">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <input type="hidden" name="pedido_id" value={pedidoId} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Venta para {clienteNombre}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Moneda">
            <select name="moneda" defaultValue={monedaPedido} className={inputClass}>
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
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Productos entregados
        </h2>

        <div className="space-y-4">
          {lineas.map((linea) => {
            const diferencia = linea.cantidad_pedida - linea.cantidad_entregada;
            return (
              <div
                key={linea.pedido_detalle_id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <input
                  type="hidden"
                  name="pedido_detalle_id[]"
                  value={linea.pedido_detalle_id}
                />
                <p className="mb-3 font-medium text-gray-900">
                  {linea.producto_nombre}{" "}
                  <span className="font-normal text-gray-500">
                    (pedido: {linea.cantidad_pedida}
                    {linea.unidad_medida_descripcion
                      ? ` ${linea.unidad_medida_descripcion}`
                      : ""}
                    )
                  </span>
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Field label="Cantidad entregada">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={linea.cantidad_pedida}
                      name="cantidad_entregada[]"
                      value={linea.cantidad_entregada || ""}
                      onChange={(e) =>
                        updateLinea(linea.pedido_detalle_id, {
                          cantidad_entregada: Number(e.target.value),
                        })
                      }
                      className={inputClass}
                    />
                    {linea.factor !== 1 && (
                      <p className="mt-1 text-xs text-gray-400">
                        = {linea.cantidad_entregada * linea.factor} unidades
                      </p>
                    )}
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
                        min="0"
                        name="precio_unitario[]"
                        value={linea.precio_unitario || ""}
                        onChange={(e) =>
                          updateLinea(linea.pedido_detalle_id, {
                            precio_unitario: Number(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    )}
                  </Field>
                  <Field label="Subtotal">
                    <input
                      disabled
                      value={(
                        linea.cantidad_entregada * linea.precio_unitario
                      ).toFixed(2)}
                      className={`${inputClass} bg-gray-50 text-gray-500`}
                    />
                  </Field>
                </div>

                {diferencia > 0 && (
                  <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-red-50 p-3 sm:grid-cols-2">
                    <p className="col-span-full text-sm text-red-700">
                      Diferencia de {diferencia}: se registrará como merma
                      (devolución).
                    </p>
                    <Field label="Tipo de devolución">
                      <select
                        name="tipo_devolucion[]"
                        value={linea.tipo_devolucion}
                        onChange={(e) =>
                          updateLinea(linea.pedido_detalle_id, {
                            tipo_devolucion: e.target.value,
                          })
                        }
                        className={inputClass}
                      >
                        {TIPOS_DEVOLUCION.map((t) => (
                          <option key={t} value={t}>
                            {TIPO_DEVOLUCION_LABEL[t]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Motivo">
                      <input
                        name="motivo[]"
                        value={linea.motivo}
                        onChange={(e) =>
                          updateLinea(linea.pedido_detalle_id, {
                            motivo: e.target.value,
                          })
                        }
                        className={inputClass}
                      />
                    </Field>
                  </div>
                )}
                {diferencia <= 0 && (
                  <>
                    <input type="hidden" name="tipo_devolucion[]" value="" />
                    <input type="hidden" name="motivo[]" value="" />
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="ml-auto w-56 space-y-1 text-sm">
          <div className="flex items-center justify-between text-gray-600">
            <span>Total</span>
            <span>{total.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between text-gray-600">
            <span>Descuento</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="descuento"
              value={descuento || ""}
              onChange={(e) => setDescuento(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1 text-right text-sm focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Neto a pagar</span>
            <span>{netoAPagar.toFixed(2)}</span>
          </div>
        </div>
      </section>

      <SubmitButton pendingLabel="Registrando venta...">
        Registrar venta
      </SubmitButton>
    </form>
  );
}

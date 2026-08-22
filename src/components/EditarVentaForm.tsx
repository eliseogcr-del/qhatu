"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import SubmitButton from "./SubmitButton";
import ProductoCombobox from "./ProductoCombobox";
import { TIPOS_AJUSTE_VENTA, TIPO_AJUSTE_VENTA_LABEL } from "@/lib/ajuste-venta-tipos";

type Producto = { id: string; nombre: string; precio_venta: number };

type Linea = {
  key: string;
  linea_id: string | null;
  producto_id: string;
  producto_nombre: string;
  cantidadPedido: number;
  cantidad: number;
  precio_unitario: number;
  esNueva: boolean;
  tipoAjuste: string;
  detalleAjuste: string;
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
  stockPorProducto,
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
    cantidad_pedido: number;
    cantidad_entregada: number;
    precio_unitario: number;
  }[];
  productos: Producto[];
  // Stock actual del almacén de la venta, por producto — solo informativo
  // (la validación real de stock ya la hace el servidor al guardar).
  stockPorProducto: Record<string, number>;
  cobrado: number;
  moneda: string;
}) {
  const [lineas, setLineas] = useState<Linea[]>(
    lineasIniciales.map((l) => ({
      key: keyFor(),
      linea_id: l.id,
      producto_id: l.producto_id,
      producto_nombre: l.producto_nombre,
      cantidadPedido: l.cantidad_pedido,
      cantidad: l.cantidad_entregada,
      precio_unitario: l.precio_unitario,
      esNueva: false,
      tipoAjuste: "",
      detalleAjuste: "",
    })),
  );

  const [aviso, setAviso] = useState<string | null>(null);

  const actualizarLinea = (key: string, patch: Partial<Linea>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const seleccionarProducto = (key: string, productoId: string) => {
    const yaExiste =
      productoId !== "" &&
      lineas.some((l) => l.key !== key && l.producto_id === productoId);

    if (yaExiste) {
      const producto = productos.find((p) => p.id === productoId);
      const nombreExistente =
        producto?.nombre ??
        lineas.find((l) => l.producto_id === productoId)?.producto_nombre ??
        "Este producto";
      setAviso(
        `"${nombreExistente}" ya está en la venta. Ajusta la cantidad en esa línea en vez de agregarlo de nuevo.`,
      );
      return;
    }

    setAviso(null);
    const producto = productos.find((p) => p.id === productoId);
    actualizarLinea(key, {
      producto_id: productoId,
      precio_unitario: producto?.precio_venta ?? 0,
    });
  };

  const agregarLinea = () => {
    setLineas((prev) => [
      ...prev,
      {
        key: keyFor(),
        linea_id: null,
        producto_id: "",
        producto_nombre: "",
        cantidadPedido: 0,
        cantidad: 1,
        precio_unitario: 0,
        esNueva: true,
        tipoAjuste: "",
        detalleAjuste: "",
      },
    ]);
  };

  // Para una línea que ya venía del pedido, "Quitar" no la borra sin
  // dejar rastro: la deja en cantidad 0, lo que activa el mismo cuadro
  // de motivo que una reducción parcial (el producto vuelve a stock, no
  // es merma). Solo las líneas agregadas en esta misma edición (esNueva)
  // se pueden quitar sin más, porque todavía no existen en la base.
  const quitarLinea = (key: string) => {
    const linea = lineas.find((l) => l.key === key);
    if (linea && !linea.esNueva) {
      actualizarLinea(key, { cantidad: 0 });
      return;
    }
    setLineas((prev) => prev.filter((l) => l.key !== key));
  };

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0);
  const totalMenorQueCobrado = total < cobrado;

  const tieneDuplicados = (() => {
    const vistos = new Set<string>();
    for (const l of lineas) {
      if (!l.producto_id) continue;
      if (vistos.has(l.producto_id)) return true;
      vistos.add(l.producto_id);
    }
    return false;
  })();

  const requiereMotivo = (l: Linea) => !l.esNueva && l.cantidad < l.cantidadPedido;
  const faltaMotivo = lineas.some((l) => requiereMotivo(l) && !l.tipoAjuste);

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (tieneDuplicados) {
          e.preventDefault();
          setAviso(
            "Hay un producto repetido en la venta. Quita la línea duplicada antes de guardar.",
          );
          return;
        }
        if (faltaMotivo) {
          e.preventDefault();
          setAviso(
            "Indica el motivo por el que se redujo la cantidad de un producto por debajo de lo pedido.",
          );
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

      <input type="hidden" name="venta_id" value={ventaId} />

      <div className="space-y-3">
        {lineas.map((linea) => (
          <div key={linea.key} className="space-y-2">
          <div
            className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_120px_140px_140px_auto]"
          >
            <input type="hidden" name="linea_id[]" value={linea.linea_id ?? ""} />
            <input type="hidden" name="tipo_ajuste[]" value={linea.tipoAjuste} />
            <input type="hidden" name="detalle_ajuste[]" value={linea.detalleAjuste} />

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Producto
              </label>
              {linea.esNueva ? (
                <ProductoCombobox
                  productos={productos}
                  value={linea.producto_id}
                  onChange={(productoId) => seleccionarProducto(linea.key, productoId)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
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
                value={linea.cantidad || ""}
                onChange={(e) =>
                  actualizarLinea(linea.key, { cantidad: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
              {linea.producto_id in stockPorProducto && (
                <p className="mt-1 text-xs text-gray-400">
                  Disponible: {stockPorProducto[linea.producto_id]}
                </p>
              )}
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
                value={linea.precio_unitario || ""}
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
              disabled={!linea.esNueva && linea.cantidad === 0}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 size={14} />
              {!linea.esNueva && linea.cantidad === 0 ? "Quitado" : "Quitar"}
            </button>
          </div>

          {requiereMotivo(linea) && (
            <div className="grid grid-cols-1 gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-amber-800">
                  Motivo — pediste {linea.cantidadPedido} y se entregan {linea.cantidad}
                </label>
                <select
                  value={linea.tipoAjuste}
                  onChange={(e) =>
                    actualizarLinea(linea.key, { tipoAjuste: e.target.value })
                  }
                  className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Selecciona un motivo</option>
                  {TIPOS_AJUSTE_VENTA.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_AJUSTE_VENTA_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-amber-800">
                  Detalle (opcional)
                </label>
                <input
                  value={linea.detalleAjuste}
                  onChange={(e) =>
                    actualizarLinea(linea.key, { detalleAjuste: e.target.value })
                  }
                  className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
              </div>
              <p className="sm:col-span-2 text-xs text-amber-700">
                El producto vuelve a stock (no es merma) — se podrá vender de nuevo.
              </p>
            </div>
          )}
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

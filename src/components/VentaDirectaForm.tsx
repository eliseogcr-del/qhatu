"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import SubmitButton from "./SubmitButton";
import ClienteCombobox from "./ClienteCombobox";
import ProductoCombobox from "./ProductoCombobox";
import { consultarPrecioLinea, consultarSaldoCliente } from "@/app/(app)/precios/actions";
import { formatFecha } from "@/lib/fecha";

type Cliente = { id: string; nombre: string };
type Producto = {
  id: string;
  nombre: string;
  control_inventario: boolean;
  unidad_medida_id: string | null;
  unidad_venta_defecto_id: string | null;
  precio_editable: boolean;
  es_promocion: boolean;
  promocion_de_producto_id: string | null;
  promocion_cantidad_minima: number;
  promocion_cantidad_regalo: number;
  promocion_precio: number;
};

// Cuántas unidades corresponden: los múltiplos de la cantidad mínima que
// alcanzó el producto atado, cada uno multiplicado por la cantidad a
// regalar configurada (ej. cantidad mínima 12, cantidad a regalar 2 ->
// con 24 en la venta se agregan 4). El servidor vuelve a calcular esto
// al guardar, esto solo refleja lo mismo en pantalla.
function cantidadPromoCalculada(promo: Producto, lineas: Linea[]): number {
  const lineaAtada = lineas.find((l) => l.producto_id === promo.promocion_de_producto_id);
  if (!lineaAtada) return 0;
  return (
    Math.floor(lineaAtada.cantidad / promo.promocion_cantidad_minima) * promo.promocion_cantidad_regalo
  );
}
type UnidadMedida = { id: string; descripcion: string; cantidad: number };

type Linea = {
  key: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  unidad_medida_id: string;
};

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";
const inputBloqueadoClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700";

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

export default function VentaDirectaForm({
  action,
  error,
  clientes,
  productos,
  unidadesMedida,
  almacenes,
  stockPorAlmacen,
  almacenSesion,
  preciosBloqueados,
  descuentoHabilitado,
}: {
  action: (formData: FormData) => void;
  error?: string;
  clientes: Cliente[];
  productos: Producto[];
  unidadesMedida: UnidadMedida[];
  // Solo se pasa (con al menos un local) cuando quien registra es admin
  // — un vendedor tiene su almacén fijo y el servidor lo asigna solo.
  almacenes?: { id: string; nombre: string }[];
  // Stock por producto+almacén, clave `${productoId}::${almacenId}`, para
  // solo ofrecer lo que ese almacén realmente tiene (ej. lo que un
  // vendedor de campo lleva cargado en su almacén móvil).
  stockPorAlmacen: Record<string, number>;
  // Almacén fijo del usuario (vendedor); null/undefined si es admin.
  almacenSesion?: string | null;
  // Configuración de Precios → Bloqueo de precios.
  preciosBloqueados: boolean;
  // Configuración de Precios → Descuento en Ventas; deshabilitado por defecto.
  descuentoHabilitado: boolean;
}) {
  const [lineas, setLineas] = useState<Linea[]>([newLinea()]);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
  const [almacenSeleccionado, setAlmacenSeleccionado] = useState(almacenSesion ?? "");
  const [descuento, setDescuento] = useState(0);
  const [clienteId, setClienteId] = useState("");
  const [deudaCliente, setDeudaCliente] = useState<{
    saldo: number;
    moneda: string;
    fechaUltimaVenta: string;
  } | null>(null);

  // Solo informativo: avisa si el cliente elegido tiene ventas anteriores
  // sin cobrar, pero no impide continuar con esta venta nueva.
  // consultarSaldoCliente resuelve a null cuando clienteId viene vacío.
  useEffect(() => {
    let vigente = true;
    consultarSaldoCliente(clienteId).then((resultado) => {
      if (vigente) setDeudaCliente(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  // Solo productos reales van al buscador — una promoción nunca se elige
  // a mano, aparece y desaparece sola (ver sincronizarPromociones) apenas
  // el producto que la habilita alcanza su cantidad mínima en la venta.
  const productosSeleccionables = productos.filter((p) => {
    if (p.es_promocion) return false;
    if (!p.control_inventario) return true;
    if (!almacenSeleccionado) return true;
    return (stockPorAlmacen[`${p.id}::${almacenSeleccionado}`] ?? 0) > 0;
  });

  // Recorre cada promoción y agrega, actualiza o quita su línea según la
  // cantidad que tenga en ese momento el producto que la habilita — se
  // corre después de cualquier cambio a `lineas` para que la promoción
  // siempre quede sincronizada sin que el usuario tenga que buscarla ni
  // tocarla a mano.
  const sincronizarPromociones = (base: Linea[]): Linea[] => {
    let next = base;
    productos
      .filter((p) => p.es_promocion)
      .forEach((promo) => {
        const idxAtada = next.findIndex(
          (l) => l.producto_id === promo.promocion_de_producto_id,
        );
        const cantidadPromo = cantidadPromoCalculada(promo, next);
        const idxPromo = next.findIndex((l) => l.producto_id === promo.id);

        if (cantidadPromo > 0) {
          if (idxPromo === -1) {
            nextKey += 1;
            const nueva: Linea = {
              key: `promo${nextKey}`,
              producto_id: promo.id,
              cantidad: cantidadPromo,
              precio_unitario: promo.promocion_precio,
              unidad_medida_id: promo.unidad_venta_defecto_id ?? promo.unidad_medida_id ?? "",
            };
            const posicion = idxAtada === -1 ? next.length : idxAtada + 1;
            next = [...next.slice(0, posicion), nueva, ...next.slice(posicion)];
          } else if (
            next[idxPromo].cantidad !== cantidadPromo ||
            next[idxPromo].precio_unitario !== promo.promocion_precio
          ) {
            next = next.map((l, i) =>
              i === idxPromo
                ? { ...l, cantidad: cantidadPromo, precio_unitario: promo.promocion_precio }
                : l,
            );
          }
        } else if (idxPromo !== -1) {
          next = next.filter((_, i) => i !== idxPromo);
        }
      });
    return next;
  };

  const fijarLineas = (updater: (prev: Linea[]) => Linea[]) => {
    setLineas((prev) => sincronizarPromociones(updater(prev)));
  };

  const updateLinea = (key: string, patch: Partial<Linea>) => {
    fijarLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const resolverPrecioLinea = async (
    key: string,
    productoId: string,
    unidadMedidaId: string,
  ) => {
    if (!productoId) return;
    const precio = await consultarPrecioLinea(
      clienteId || null,
      productoId,
      unidadMedidaId || null,
      almacenSeleccionado || null,
    );
    updateLinea(key, { precio_unitario: precio });
  };

  // Si el precio está bloqueado, cambiar de cliente (precio especial) o de
  // almacén (Campo/Digital) obliga a recalcular lo ya elegido. Cuando no
  // está bloqueado no se toca nada, para no pisar un precio que el
  // usuario ya haya escrito a mano.
  useEffect(() => {
    if (!preciosBloqueados) return;
    lineas.forEach((l) => {
      const p = productos.find((pp) => pp.id === l.producto_id);
      if (l.producto_id && !p?.es_promocion) {
        resolverPrecioLinea(l.key, l.producto_id, l.unidad_medida_id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, almacenSeleccionado, preciosBloqueados]);

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
    const unidadMedidaId = producto?.unidad_venta_defecto_id ?? producto?.unidad_medida_id ?? "";
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

  const total = lineas.reduce(
    (acc, l) => acc + l.cantidad * l.precio_unitario,
    0,
  );
  const netoAPagar = Math.max(total - descuento, 0);

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
          return;
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
      {deudaCliente && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          Este cliente debe {deudaCliente.moneda} {deudaCliente.saldo.toFixed(2)} de una venta
          anterior (última con saldo pendiente: {formatFecha(deudaCliente.fechaUltimaVenta)}).
          Puedes continuar con esta venta de todas formas.
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Datos de la venta
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente">
            <ClienteCombobox clientes={clientes} onChange={setClienteId} />
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
                  fijarLineas((prev) =>
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
        {almacenSeleccionado && productosSeleccionables.length === 0 && (
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
                {productoElegido?.es_promocion ? (
                  <>
                    <div className={inputBloqueadoClass}>{productoElegido.nombre}</div>
                    <input type="hidden" name="producto_id[]" value={linea.producto_id} />
                  </>
                ) : (
                  <ProductoCombobox
                    productos={productosSeleccionables}
                    value={linea.producto_id}
                    onChange={(productoId) => seleccionarProducto(linea.key, productoId)}
                    className={inputClass}
                  />
                )}
                {productoElegido?.es_promocion && (
                  <p className="mt-1 text-xs font-medium text-emerald-700">
                    Promoción — se agregó sola, regalo por la cantidad vendida
                  </p>
                )}
              </Field>
              <Field label="Cantidad">
                {productoElegido?.es_promocion ? (
                  <>
                    <div className={inputBloqueadoClass}>{linea.cantidad}</div>
                    <input type="hidden" name="cantidad[]" value={linea.cantidad} />
                  </>
                ) : (
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="cantidad[]"
                    value={linea.cantidad || ""}
                    onChange={(e) =>
                      updateLinea(linea.key, {
                        cantidad: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                )}
                {factor !== 1 && (
                  <p className="mt-1 text-xs text-gray-400">
                    = {cantidadBase} unidades
                  </p>
                )}
                {stockDisponible !== null && (
                  <p
                    className={`mt-1 text-xs ${cantidadBase > stockDisponible ? "text-red-600" : "text-gray-400"}`}
                  >
                    Disponible: {stockDisponible}
                  </p>
                )}
              </Field>
              <Field label="Unidad de medida">
                {productoElegido?.es_promocion ? (
                  <>
                    <div className={inputBloqueadoClass}>
                      {unidadesMedida.find((u) => u.id === linea.unidad_medida_id)?.descripcion ??
                        "—"}
                    </div>
                    <input
                      type="hidden"
                      name="unidad_medida_id[]"
                      value={linea.unidad_medida_id}
                    />
                  </>
                ) : (
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
                )}
              </Field>
              <Field label="Precio unitario">
                {productoElegido?.es_promocion ? (
                  <>
                    <div className={inputBloqueadoClass}>{linea.precio_unitario.toFixed(2)}</div>
                    <input
                      type="hidden"
                      name="precio_unitario[]"
                      value={linea.precio_unitario}
                    />
                  </>
                ) : preciosBloqueados && !productoElegido?.precio_editable ? (
                  <>
                    <div className={`${inputBloqueadoClass} flex items-center gap-1.5`}>
                      <Lock size={12} className="shrink-0 text-gray-400" />
                      {linea.precio_unitario.toFixed(2)}
                    </div>
                    <input
                      type="hidden"
                      name="precio_unitario[]"
                      value={linea.precio_unitario}
                    />
                  </>
                ) : (
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
                )}
              </Field>
              <Field label="Subtotal">
                <input
                  disabled
                  value={(linea.cantidad * linea.precio_unitario).toFixed(2)}
                  className={`${inputClass} bg-gray-50 text-gray-500`}
                />
              </Field>
              {!productoElegido?.es_promocion && (
                <button
                  type="button"
                  onClick={() =>
                    fijarLineas((prev) =>
                      prev.length > 1
                        ? prev.filter((l) => l.key !== linea.key)
                        : prev,
                    )
                  }
                  className="h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-500 hover:bg-gray-100"
                >
                  Quitar
                </button>
              )}
            </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => fijarLineas((prev) => [...prev, newLinea()])}
          className="text-sm font-medium text-gray-700 underline hover:text-gray-900"
        >
          + Agregar producto
        </button>

        <div className="ml-auto w-56 space-y-1 text-sm">
          <div className="flex items-center justify-between text-gray-600">
            <span>Total</span>
            <span>{total.toFixed(2)}</span>
          </div>
          {descuentoHabilitado && (
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
          )}
          <div className="flex justify-between font-semibold text-gray-900">
            <span>Neto a pagar</span>
            <span>{netoAPagar.toFixed(2)}</span>
          </div>
        </div>
      </section>

      <SubmitButton pendingLabel="Registrando venta...">
        Registrar venta directa
      </SubmitButton>
    </form>
  );
}

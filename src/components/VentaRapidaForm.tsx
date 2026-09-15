"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, Plus, Trash2 } from "lucide-react";
import SubmitButton from "./SubmitButton";
import ClienteCombobox from "./ClienteCombobox";
import ProductoCombobox from "./ProductoCombobox";
import { consultarPrecioLinea, consultarSaldoCliente } from "@/app/(app)/precios/actions";
import { formatFecha } from "@/lib/fecha";

// Módulo aparte de VentaDirectaForm, hecho a medida para el vendedor de
// almacén móvil (vende parado en la calle, desde el celular, contra el
// reloj): sin Moneda/Tipo de cambio (siempre PEN al contado), cliente
// frecuente precargado, letra grande y en negrita, y al guardar se queda
// acá misma lista para la siguiente venta en vez de saltar a otra
// pantalla. No se toca VentaDirectaForm para no afectar a admin/logística
// ni al almacén digital, que siguen usando el formulario completo.

type Cliente = { id: string; nombre: string };
type Producto = {
  id: string;
  nombre: string;
  control_inventario: boolean;
  unidad_medida_id: string | null;
  unidad_venta_defecto_id: string | null;
  precio_editable: boolean;
};
type UnidadMedida = { id: string; descripcion: string; cantidad: number };

type Linea = {
  key: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  unidad_medida_id: string;
};

const campoClase =
  "w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-lg font-semibold focus:border-emerald-500 focus:outline-none";
const campoBloqueadoClase =
  "w-full rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-3 text-lg font-semibold text-gray-700";

function Field({
  label,
  children,
  chico = false,
}: {
  label: string;
  children: React.ReactNode;
  // Unidad/Precio/Subtotal quedan disponibles pero visualmente más
  // discretos — Cliente, Producto y Cantidad son los que de verdad hay
  // que leer y tocar rápido en cada venta.
  chico?: boolean;
}) {
  return (
    <div>
      <label
        className={
          chico
            ? "mb-1 block text-sm font-semibold text-gray-600"
            : "mb-1.5 block text-base font-bold text-gray-800"
        }
      >
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

export default function VentaRapidaForm({
  action,
  error,
  guardado = false,
  clientes,
  clienteFrecuenteId,
  productos,
  unidadesMedida,
  stockPorAlmacen,
  almacenSesion,
  preciosBloqueados,
}: {
  action: (formData: FormData) => void;
  error?: string;
  // El servidor manda esto tras guardar (redirect a esta misma pantalla
  // con ?guardado=1) para mostrar un mensaje de confirmación sin salir.
  guardado?: boolean;
  clientes: Cliente[];
  clienteFrecuenteId: string | null;
  productos: Producto[];
  unidadesMedida: UnidadMedida[];
  stockPorAlmacen: Record<string, number>;
  almacenSesion: string | null;
  preciosBloqueados: boolean;
}) {
  const router = useRouter();
  const [lineas, setLineas] = useState<Linea[]>([newLinea()]);
  const [avisoDuplicado, setAvisoDuplicado] = useState<string | null>(null);
  const [descuento, setDescuento] = useState(0);
  const [clienteId, setClienteId] = useState(clienteFrecuenteId ?? "");
  const [deudaCliente, setDeudaCliente] = useState<{
    saldo: number;
    moneda: string;
    fechaUltimaVenta: string;
  } | null>(null);
  const [mostrarToast, setMostrarToast] = useState(false);

  // Detecta la transición false→true de "guardado" (no solo su valor al
  // montar) para que el aviso reaparezca en cada venta registrada, sea
  // que el navegador reutilice esta misma instancia entre ventas o no.
  // El timeout de ocultarlo nunca se cancela por un cambio de props (no
  // hay cleanup atado a la prop), solo se reemplaza si llega otra venta
  // guardada antes de que termine.
  const yaGuardado = useRef(false);
  const ocultarToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (guardado && !yaGuardado.current) {
      setMostrarToast(true);
      router.replace("/ventas/rapida");
      if (ocultarToastRef.current) clearTimeout(ocultarToastRef.current);
      ocultarToastRef.current = setTimeout(() => setMostrarToast(false), 3000);
    }
    yaGuardado.current = guardado;
  }, [guardado, router]);
  useEffect(() => {
    return () => {
      if (ocultarToastRef.current) clearTimeout(ocultarToastRef.current);
    };
  }, []);

  // Solo informativo: avisa si el cliente elegido tiene ventas anteriores
  // sin cobrar, pero no impide continuar con esta venta nueva.
  useEffect(() => {
    let vigente = true;
    consultarSaldoCliente(clienteId).then((resultado) => {
      if (vigente) setDeudaCliente(resultado);
    });
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  const productosDisponibles = productos.filter((p) => {
    if (!p.control_inventario) return true;
    if (!almacenSesion) return true;
    return (stockPorAlmacen[`${p.id}::${almacenSesion}`] ?? 0) > 0;
  });

  const updateLinea = (key: string, patch: Partial<Linea>) => {
    setLineas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const resolverPrecioLinea = async (key: string, productoId: string, unidadMedidaId: string) => {
    if (!productoId) return;
    const precio = await consultarPrecioLinea(
      clienteId || null,
      productoId,
      unidadMedidaId || null,
      almacenSesion,
    );
    updateLinea(key, { precio_unitario: precio });
  };

  useEffect(() => {
    if (!preciosBloqueados) return;
    lineas.forEach((l) => {
      if (l.producto_id) resolverPrecioLinea(l.key, l.producto_id, l.unidad_medida_id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, preciosBloqueados]);

  const seleccionarProducto = (key: string, productoId: string) => {
    const yaExiste =
      productoId !== "" && lineas.some((l) => l.key !== key && l.producto_id === productoId);

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
    updateLinea(key, { producto_id: productoId, unidad_medida_id: unidadMedidaId });
    resolverPrecioLinea(key, productoId, unidadMedidaId);
  };

  const seleccionarUnidadMedida = (key: string, unidadMedidaId: string) => {
    updateLinea(key, { unidad_medida_id: unidadMedidaId });
    const linea = lineas.find((l) => l.key === key);
    if (preciosBloqueados && linea?.producto_id) {
      resolverPrecioLinea(key, linea.producto_id, unidadMedidaId);
    }
  };

  const total = lineas.reduce((acc, l) => acc + l.cantidad * l.precio_unitario, 0);
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
        }
      }}
      className="space-y-6"
    >
      {/* Siempre soles al contado — no le hace falta elegirlo en cada venta de calle. */}
      <input type="hidden" name="moneda" value="PEN" />
      <input type="hidden" name="tipo_cambio_aplicado" value={1} />

      {mostrarToast && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-base font-bold text-emerald-800">
          <CheckCircle2 size={20} className="shrink-0" />
          Venta registrada. Lista para la siguiente.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-base font-semibold text-red-700">
          {error}
        </p>
      )}
      {avisoDuplicado && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-base font-semibold text-amber-700">
          {avisoDuplicado}
        </p>
      )}
      {deudaCliente && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-base font-bold text-red-700">
          Este cliente debe {deudaCliente.moneda} {deudaCliente.saldo.toFixed(2)} de una venta
          anterior ({formatFecha(deudaCliente.fechaUltimaVenta)}). Puedes continuar de todas
          formas.
        </p>
      )}

      <Field label="Cliente">
        <ClienteCombobox
          clientes={clientes}
          defaultClienteId={clienteFrecuenteId ?? undefined}
          onChange={setClienteId}
          className={campoClase}
        />
      </Field>

      <div className="space-y-4">
        {lineas.map((linea) => {
          const productoElegido = productos.find((p) => p.id === linea.producto_id);
          const stockDisponible =
            productoElegido?.control_inventario && almacenSesion
              ? (stockPorAlmacen[`${linea.producto_id}::${almacenSesion}`] ?? 0)
              : null;
          const unidadSeleccionada = unidadesMedida.find((u) => u.id === linea.unidad_medida_id);
          const factor = unidadSeleccionada?.cantidad ?? 1;
          const cantidadBase = linea.cantidad * factor;

          return (
            <div
              key={linea.key}
              className="space-y-3 rounded-xl border-2 border-gray-200 bg-white p-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                <Field label="Producto">
                  <ProductoCombobox
                    productos={productosDisponibles}
                    value={linea.producto_id}
                    onChange={(productoId) => seleccionarProducto(linea.key, productoId)}
                    className={campoClase}
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
                    className={campoClase}
                  />
                  {factor !== 1 && (
                    <p className="mt-1 text-sm text-gray-500">= {cantidadBase} unidades</p>
                  )}
                  {stockDisponible !== null && (
                    <p
                      className={`mt-1 text-sm font-medium ${cantidadBase > stockDisponible ? "text-red-600" : "text-gray-500"}`}
                    >
                      Disponible: {stockDisponible}
                    </p>
                  )}
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                <Field label="Unidad" chico>
                  <select
                    name="unidad_medida_id[]"
                    value={linea.unidad_medida_id}
                    onChange={(e) => seleccionarUnidadMedida(linea.key, e.target.value)}
                    className={campoClase}
                  >
                    <option value="">—</option>
                    {unidadesMedida.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.descripcion}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Precio" chico>
                  {preciosBloqueados && !productoElegido?.precio_editable ? (
                    <div className={`${campoBloqueadoClase} flex items-center gap-1.5`}>
                      <Lock size={14} className="shrink-0 text-gray-400" />
                      {linea.precio_unitario.toFixed(2)}
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
                      className={campoClase}
                    />
                  )}
                  {preciosBloqueados && !productoElegido?.precio_editable && (
                    <input type="hidden" name="precio_unitario[]" value={linea.precio_unitario} />
                  )}
                </Field>
                <Field label="Subtotal" chico>
                  <input
                    disabled
                    value={(linea.cantidad * linea.precio_unitario).toFixed(2)}
                    className={`${campoClase} bg-gray-50 text-gray-500`}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() =>
                    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== linea.key) : prev))
                  }
                  aria-label="Quitar producto"
                  className="flex h-12 items-center justify-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-4 text-base font-semibold text-gray-600 hover:bg-gray-100"
                >
                  <Trash2 size={16} />
                  Quitar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setLineas((prev) => [...prev, newLinea()])}
        className="flex items-center gap-1.5 text-base font-bold text-emerald-700 hover:text-emerald-900"
      >
        <Plus size={18} />
        Agregar producto
      </button>

      <div className="space-y-1.5 rounded-xl border-2 border-gray-200 bg-white p-4 text-base font-semibold">
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
            className="w-28 rounded-lg border-2 border-gray-300 bg-white px-2 py-1.5 text-right text-base font-semibold focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div className="flex justify-between border-t border-gray-100 pt-1.5 text-xl font-bold text-gray-900">
          <span>Neto a pagar</span>
          <span>{netoAPagar.toFixed(2)}</span>
        </div>
      </div>

      <SubmitButton
        pendingLabel="Registrando venta..."
        className="w-full justify-center rounded-lg bg-emerald-600 px-4 py-4 text-lg font-bold text-white hover:bg-emerald-700"
      >
        Registrar venta
      </SubmitButton>
    </form>
  );
}

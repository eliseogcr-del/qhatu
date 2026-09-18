"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Lock, Moon, Plus, Sun, Trash2 } from "lucide-react";
import SubmitButton from "./SubmitButton";
import ClienteCombobox from "./ClienteCombobox";
import ProductoCombobox from "./ProductoCombobox";
import { consultarPrecioLinea, consultarSaldoCliente } from "@/app/(app)/precios/actions";
import { formatFecha } from "@/lib/fecha";
import { useOscuroVendedorMovil } from "@/hooks/useOscuroVendedorMovil";

// Módulo aparte de VentaDirectaForm, hecho a medida para el vendedor de
// almacén móvil (vende parado en la calle, desde el celular, contra el
// reloj): sin Moneda/Tipo de cambio (siempre PEN al contado), cliente
// frecuente precargado, letra grande y en negrita, modo oscuro opcional
// (para cansar menos la vista con el celular), envío protegido contra
// doble toque, y al guardar se queda acá misma lista para la siguiente
// venta en vez de saltar a otra pantalla. No se toca VentaDirectaForm
// para no afectar a admin/logística ni al almacén digital, que siguen
// usando el formulario completo.

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
type UnidadMedida = { id: string; descripcion: string; cantidad: number };

type Linea = {
  key: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  unidad_medida_id: string;
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

function Field({
  label,
  children,
  chico = false,
  oscuro,
}: {
  label: string;
  children: React.ReactNode;
  // Unidad/Precio/Subtotal quedan disponibles pero visualmente más
  // discretos — Cliente, Producto y Cantidad son los que de verdad hay
  // que leer y tocar rápido en cada venta.
  chico?: boolean;
  oscuro: boolean;
}) {
  const claseChico = oscuro
    ? "mb-1 block text-sm font-semibold text-gray-400"
    : "mb-1 block text-sm font-semibold text-gray-600";
  const claseGrande = oscuro
    ? "mb-1.5 block text-base font-bold text-gray-100"
    : "mb-1.5 block text-base font-bold text-gray-800";
  return (
    <div>
      <label className={chico ? claseChico : claseGrande}>{label}</label>
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
  const [oscuro, alternarOscuro] = useOscuroVendedorMovil();

  // Evita que un doble toque (muy común con el apuro/el celular en la
  // calle) mande la misma venta dos veces: se corta en seco en el propio
  // evento de submit, sin esperar a que el botón se vea deshabilitado (esa
  // actualización visual puede llegar unos milisegundos tarde). Se
  // reactiva solo cuando llega una respuesta nueva del servidor (éxito o
  // error) — nunca por su cuenta, para no arriesgar bloquear un reintento
  // legítimo si algo falla antes de que "error"/"guardado" cambien.
  const enviandoRef = useRef(false);
  useEffect(() => {
    enviandoRef.current = false;
  }, [error, guardado]);

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

  // Solo productos reales van al buscador — una promoción nunca se elige
  // a mano, aparece y desaparece sola (ver sincronizarPromociones) apenas
  // el producto que la habilita alcanza su cantidad mínima en la venta.
  const productosSeleccionables = productos.filter((p) => {
    if (p.es_promocion) return false;
    if (!p.control_inventario) return true;
    if (!almacenSesion) return true;
    return (stockPorAlmacen[`${p.id}::${almacenSesion}`] ?? 0) > 0;
  });

  // Recorre cada promoción y agrega, actualiza o quita su línea según la
  // cantidad que tenga en ese momento el producto que la habilita — se
  // corre después de cualquier cambio a `lineas` para que la promoción
  // siempre quede sincronizada sin que el vendedor tenga que buscarla ni
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
      const p = productos.find((pp) => pp.id === l.producto_id);
      if (l.producto_id && !p?.es_promocion) {
        resolverPrecioLinea(l.key, l.producto_id, l.unidad_medida_id);
      }
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

  // Paleta de todo el formulario en un solo lugar — evita repetir el
  // ternario claro/oscuro en cada elemento.
  const claseCard = oscuro
    ? "rounded-xl border-2 border-gray-700 bg-gray-900 p-4 shadow-sm sm:p-6"
    : "rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-6";
  const claseTitulo = oscuro ? "text-2xl font-bold text-gray-50" : "text-2xl font-bold text-gray-900";
  const claseVolver = oscuro
    ? "text-sm font-medium text-gray-300 hover:text-white"
    : "text-sm font-medium text-gray-600 hover:underline";
  const claseToggle = oscuro
    ? "flex h-9 w-9 items-center justify-center rounded-lg border-2 border-gray-600 bg-gray-800 text-amber-300 hover:bg-gray-700"
    : "flex h-9 w-9 items-center justify-center rounded-lg border-2 border-gray-300 bg-white text-gray-600 hover:bg-gray-100";
  const claseCampo = oscuro
    ? "w-full rounded-lg border-2 border-gray-600 bg-gray-800 px-4 py-3 text-lg font-semibold text-gray-100 focus:border-emerald-400 focus:outline-none"
    : "w-full rounded-lg border-2 border-gray-300 bg-white px-4 py-3 text-lg font-semibold text-gray-900 focus:border-emerald-500 focus:outline-none";
  const claseCampoBloqueado = oscuro
    ? "w-full rounded-lg border-2 border-gray-700 bg-gray-800/60 px-4 py-3 text-lg font-semibold text-gray-300"
    : "w-full rounded-lg border-2 border-gray-200 bg-gray-50 px-4 py-3 text-lg font-semibold text-gray-700";
  const claseLineaCard = oscuro
    ? "space-y-3 rounded-xl border-2 border-gray-700 bg-gray-800 p-3"
    : "space-y-3 rounded-xl border-2 border-gray-200 bg-white p-3";
  const claseQuitar = oscuro
    ? "flex h-12 items-center justify-center gap-1.5 rounded-lg border-2 border-gray-600 bg-gray-800 px-4 text-base font-semibold text-gray-300 hover:bg-gray-700"
    : "flex h-12 items-center justify-center gap-1.5 rounded-lg border-2 border-gray-300 bg-white px-4 text-base font-semibold text-gray-600 hover:bg-gray-100";
  const claseAgregar = oscuro
    ? "flex items-center gap-1.5 text-base font-bold text-emerald-400 hover:text-emerald-300"
    : "flex items-center gap-1.5 text-base font-bold text-emerald-700 hover:text-emerald-900";
  const claseTotales = oscuro
    ? "space-y-1.5 rounded-xl border-2 border-gray-700 bg-gray-800 p-4 text-base font-semibold text-gray-300"
    : "space-y-1.5 rounded-xl border-2 border-gray-200 bg-white p-4 text-base font-semibold text-gray-600";
  const claseDescuento = oscuro
    ? "w-28 rounded-lg border-2 border-gray-600 bg-gray-800 px-2 py-1.5 text-right text-base font-semibold text-gray-100 focus:border-emerald-400 focus:outline-none"
    : "w-28 rounded-lg border-2 border-gray-300 bg-white px-2 py-1.5 text-right text-base font-semibold focus:border-emerald-500 focus:outline-none";
  const claseNeto = oscuro
    ? "flex justify-between border-t border-gray-700 pt-1.5 text-xl font-bold text-gray-50"
    : "flex justify-between border-t border-gray-100 pt-1.5 text-xl font-bold text-gray-900";
  const claseTextoSecundario = oscuro ? "text-gray-400" : "text-gray-500";

  return (
    <div className={claseCard}>
      <div className="mb-4 flex items-center justify-between">
        <h1 className={claseTitulo}>Venta rápida</h1>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={alternarOscuro}
            aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            title={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            className={claseToggle}
          >
            {oscuro ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/dashboard" className={`flex items-center gap-1 ${claseVolver}`}>
            <ArrowLeft size={16} />
            Panel
          </Link>
        </div>
      </div>

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
          if (enviandoRef.current) {
            e.preventDefault();
            return;
          }
          enviandoRef.current = true;
        }}
        className="space-y-6"
      >
        {/* Siempre soles al contado — no le hace falta elegirlo en cada venta de calle. */}
        <input type="hidden" name="moneda" value="PEN" />
        <input type="hidden" name="tipo_cambio_aplicado" value={1} />

        {mostrarToast && (
          <p
            className={
              oscuro
                ? "flex items-center gap-2 rounded-lg border border-emerald-700 bg-emerald-950 p-3 text-base font-bold text-emerald-300"
                : "flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-base font-bold text-emerald-800"
            }
          >
            <CheckCircle2 size={20} className="shrink-0" />
            Venta registrada. Lista para la siguiente.
          </p>
        )}
        {error && (
          <p
            className={
              oscuro
                ? "rounded-lg border border-red-800 bg-red-950 p-3 text-base font-semibold text-red-300"
                : "rounded-lg border border-red-200 bg-red-50 p-3 text-base font-semibold text-red-700"
            }
          >
            {error}
          </p>
        )}
        {avisoDuplicado && (
          <p
            className={
              oscuro
                ? "rounded-lg border border-amber-800 bg-amber-950 p-3 text-base font-semibold text-amber-300"
                : "rounded-lg border border-amber-200 bg-amber-50 p-3 text-base font-semibold text-amber-700"
            }
          >
            {avisoDuplicado}
          </p>
        )}
        {deudaCliente && (
          <p
            className={
              oscuro
                ? "rounded-lg border border-red-800 bg-red-950 p-3 text-base font-bold text-red-300"
                : "rounded-lg border border-red-200 bg-red-50 p-3 text-base font-bold text-red-700"
            }
          >
            Este cliente debe {deudaCliente.moneda} {deudaCliente.saldo.toFixed(2)} de una venta
            anterior ({formatFecha(deudaCliente.fechaUltimaVenta)}). Puedes continuar de todas
            formas.
          </p>
        )}

        <Field label="Cliente" oscuro={oscuro}>
          <ClienteCombobox
            clientes={clientes}
            defaultClienteId={clienteFrecuenteId ?? undefined}
            onChange={setClienteId}
            className={claseCampo}
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
              <div key={linea.key} className={claseLineaCard}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
                  <Field label="Producto" oscuro={oscuro}>
                    {productoElegido?.es_promocion ? (
                      <>
                        <div className={claseCampoBloqueado}>{productoElegido.nombre}</div>
                        <input type="hidden" name="producto_id[]" value={linea.producto_id} />
                      </>
                    ) : (
                      <ProductoCombobox
                        productos={productosSeleccionables}
                        value={linea.producto_id}
                        onChange={(productoId) => seleccionarProducto(linea.key, productoId)}
                        className={claseCampo}
                      />
                    )}
                    {productoElegido?.es_promocion && (
                      <p
                        className={`mt-1 text-sm font-bold ${oscuro ? "text-emerald-400" : "text-emerald-700"}`}
                      >
                        Promoción — se agregó sola, regalo por la cantidad vendida
                      </p>
                    )}
                  </Field>
                  <Field label="Cantidad" oscuro={oscuro}>
                    {productoElegido?.es_promocion ? (
                      <>
                        <div className={claseCampoBloqueado}>{linea.cantidad}</div>
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
                          updateLinea(linea.key, { cantidad: Number(e.target.value) })
                        }
                        className={claseCampo}
                      />
                    )}
                    {factor !== 1 && (
                      <p className={`mt-1 text-sm ${claseTextoSecundario}`}>
                        = {cantidadBase} unidades
                      </p>
                    )}
                    {stockDisponible !== null && (
                      <p
                        className={`mt-1 text-sm font-medium ${
                          cantidadBase > stockDisponible
                            ? oscuro
                              ? "text-red-400"
                              : "text-red-600"
                            : claseTextoSecundario
                        }`}
                      >
                        Disponible: {stockDisponible}
                      </p>
                    )}
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                  <Field label="Unidad" chico oscuro={oscuro}>
                    {productoElegido?.es_promocion ? (
                      <>
                        <div className={claseCampoBloqueado}>
                          {unidadesMedida.find((u) => u.id === linea.unidad_medida_id)
                            ?.descripcion ?? "—"}
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
                        className={claseCampo}
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
                  <Field label="Precio" chico oscuro={oscuro}>
                    {productoElegido?.es_promocion ? (
                      <>
                        <div className={claseCampoBloqueado}>
                          {linea.precio_unitario.toFixed(2)}
                        </div>
                        <input
                          type="hidden"
                          name="precio_unitario[]"
                          value={linea.precio_unitario}
                        />
                      </>
                    ) : preciosBloqueados && !productoElegido?.precio_editable ? (
                      <>
                        <div className={`${claseCampoBloqueado} flex items-center gap-1.5`}>
                          <Lock size={14} className="shrink-0 text-gray-400" />
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
                          updateLinea(linea.key, { precio_unitario: Number(e.target.value) })
                        }
                        className={claseCampo}
                      />
                    )}
                  </Field>
                  <Field label="Subtotal" chico oscuro={oscuro}>
                    <input
                      disabled
                      value={(linea.cantidad * linea.precio_unitario).toFixed(2)}
                      className={`${claseCampo} ${oscuro ? "bg-gray-800/60 text-gray-400" : "bg-gray-50 text-gray-500"}`}
                    />
                  </Field>
                  {!productoElegido?.es_promocion && (
                    <button
                      type="button"
                      onClick={() =>
                        fijarLineas((prev) =>
                          prev.length > 1 ? prev.filter((l) => l.key !== linea.key) : prev,
                        )
                      }
                      aria-label="Quitar producto"
                      className={claseQuitar}
                    >
                      <Trash2 size={16} />
                      Quitar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button type="button" onClick={() => fijarLineas((prev) => [...prev, newLinea()])} className={claseAgregar}>
          <Plus size={18} />
          Agregar producto
        </button>

        <div className={claseTotales}>
          <div className="flex items-center justify-between">
            <span>Total</span>
            <span>{total.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Descuento</span>
            <input
              type="number"
              step="0.01"
              min="0"
              name="descuento"
              value={descuento || ""}
              onChange={(e) => setDescuento(Number(e.target.value) || 0)}
              placeholder="0"
              className={claseDescuento}
            />
          </div>
          <div className={claseNeto}>
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
    </div>
  );
}

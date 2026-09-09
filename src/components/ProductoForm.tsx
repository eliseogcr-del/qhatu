import { Save } from "lucide-react";
import SubmitButton from "./SubmitButton";

export type ProductoInitialValues = {
  codigo_barra: string | null;
  codigo_proveedor: string | null;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  grupo: string | null;
  familia: string | null;
  modelo: string | null;
  proveedor_id: string | null;
  stock_minimo: number | null;
  stock_maximo: number | null;
  afectacion_impuesto: string | null;
  tipo_impuesto: string | null;
  cualidad: string | null;
  control_inventario: boolean;
  tipo_producto: string;
  lugar_elaboracion: string | null;
  precio_campo: number;
  precio_digital: number;
  precio_venta_moneda: string;
  costo_referencial: number | null;
  unidad_medida_id: string | null;
  unidad_venta_defecto_id: string | null;
  precio_editable: boolean;
  activo: boolean;
};

const emptyValues: ProductoInitialValues = {
  codigo_barra: null,
  codigo_proveedor: null,
  nombre: "",
  descripcion: null,
  marca: null,
  grupo: null,
  familia: null,
  modelo: null,
  proveedor_id: null,
  stock_minimo: null,
  stock_maximo: null,
  afectacion_impuesto: "Gravado",
  tipo_impuesto: "IGV 18%",
  cualidad: null,
  control_inventario: true,
  tipo_producto: "bien",
  lugar_elaboracion: null,
  precio_campo: 0,
  precio_digital: 0,
  precio_venta_moneda: "PEN",
  costo_referencial: null,
  unidad_medida_id: null,
  unidad_venta_defecto_id: null,
  precio_editable: false,
  activo: true,
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

export default function ProductoForm({
  action,
  initialValues,
  error,
  submitLabel,
  proveedores,
  unidadesMedida,
  q,
}: {
  action: (formData: FormData) => void;
  initialValues?: ProductoInitialValues;
  error?: string;
  submitLabel: string;
  proveedores: { id: string; nombre: string }[];
  unidadesMedida: { id: string; descripcion: string }[];
  // Búsqueda activa en el listado de Productos al momento de entrar a este
  // formulario — se reenvía para volver a ella tras guardar, sin perderla.
  q?: string;
}) {
  const values = initialValues ?? emptyValues;

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="_q" value={q ?? ""} />
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Datos generales
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <input
              name="nombre"
              required
              defaultValue={values.nombre}
              className={inputClass}
            />
          </Field>
          <Field label="Marca">
            <input
              name="marca"
              defaultValue={values.marca ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Grupo">
            <input
              name="grupo"
              defaultValue={values.grupo ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Familia">
            <input
              name="familia"
              defaultValue={values.familia ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Modelo">
            <input
              name="modelo"
              defaultValue={values.modelo ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Proveedor">
            <select
              name="proveedor_id"
              defaultValue={values.proveedor_id ?? ""}
              className={inputClass}
            >
              <option value="">Sin proveedor</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Descripción">
          <textarea
            name="descripcion"
            defaultValue={values.descripcion ?? ""}
            rows={3}
            className={inputClass}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Códigos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Código de barra">
            <input
              name="codigo_barra"
              defaultValue={values.codigo_barra ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Código de proveedor">
            <input
              name="codigo_proveedor"
              defaultValue={values.codigo_proveedor ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Precio e impuestos
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Precio Campo">
            <input
              type="number"
              step="0.01"
              min="0.01"
              name="precio_campo"
              required
              defaultValue={values.precio_campo || ""}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">
              Almacén principal, móviles y demás locales físicos.
            </p>
          </Field>
          <Field label="Precio Digital">
            <input
              type="number"
              step="0.01"
              min="0.01"
              name="precio_digital"
              required
              defaultValue={values.precio_digital || ""}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">
              Ventas por el almacén marcado como digital.
            </p>
          </Field>
          <Field label="Moneda">
            <select
              name="precio_venta_moneda"
              defaultValue={values.precio_venta_moneda}
              className={inputClass}
            >
              <option value="PEN">Soles (PEN)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </Field>
          <Field label="Costo referencial">
            <input
              type="number"
              step="0.01"
              name="costo_referencial"
              defaultValue={values.costo_referencial ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Afectación al impuesto">
            <select
              name="afectacion_impuesto"
              defaultValue={values.afectacion_impuesto ?? "Gravado"}
              className={inputClass}
            >
              <option value="Gravado">Gravado</option>
              <option value="Exonerado">Exonerado</option>
              <option value="Inafecto">Inafecto</option>
            </select>
          </Field>
          <Field label="Tipo de impuesto">
            <select
              name="tipo_impuesto"
              defaultValue={values.tipo_impuesto ?? "IGV 18%"}
              className={inputClass}
            >
              <option value="IGV 18%">IGV 18%</option>
              <option value="Ninguno">Ninguno</option>
            </select>
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="precio_editable"
            defaultChecked={values.precio_editable}
            className="h-4 w-4 rounded border-gray-300"
          />
          Permitir editar el precio a mano siempre (excepción al bloqueo de precios)
        </label>
        <p className="-mt-2 text-xs text-gray-400">
          Para líneas tipo &quot;DELIVERY&quot;, sin precio de lista fijo:
          se puede escribir el precio a mano en Pedidos, Ventas y
          Cotizaciones aunque el bloqueo global de precios esté activado.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Inventario y producción
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Tipo de producto">
            <select
              name="tipo_producto"
              defaultValue={values.tipo_producto}
              className={inputClass}
            >
              <option value="bien">Bien</option>
              <option value="servicio">Servicio</option>
              <option value="insumo">Insumo</option>
            </select>
          </Field>
          <Field label="Lugar de elaboración">
            <input
              name="lugar_elaboracion"
              defaultValue={values.lugar_elaboracion ?? ""}
              placeholder="Ej: almacén propio, local del cliente"
              className={inputClass}
            />
          </Field>
          <Field label="Unidad de medida">
            <select
              name="unidad_medida_id"
              defaultValue={values.unidad_medida_id ?? ""}
              className={inputClass}
            >
              {unidadesMedida.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.descripcion}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              La unidad base del producto: en qué se almacena y por
              cuánto está el Precio Campo/Digital. Cambiarla cambia el
              precio efectivo por unidad — no la toques solo para
              acelerar el ingreso de ventas, usa el campo de abajo.
            </p>
          </Field>
          <Field label="Unidad de venta por defecto (opcional)">
            <select
              name="unidad_venta_defecto_id"
              defaultValue={values.unidad_venta_defecto_id ?? ""}
              className={inputClass}
            >
              <option value="">Usar la unidad de medida del producto</option>
              {unidadesMedida.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.descripcion}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Solo para agilizar el ingreso: la unidad que se
              preselecciona al agregar este producto en Pedidos, Ventas y
              Cotizaciones (se puede cambiar igual en cada línea). No
              afecta el precio ni el inventario.
            </p>
          </Field>
          <Field label="Cualidad">
            <input
              name="cualidad"
              defaultValue={values.cualidad ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Stock mínimo">
            <input
              type="number"
              step="0.01"
              name="stock_minimo"
              defaultValue={values.stock_minimo ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Stock máximo">
            <input
              type="number"
              step="0.01"
              name="stock_maximo"
              defaultValue={values.stock_maximo ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="control_inventario"
            defaultChecked={values.control_inventario}
            className="h-4 w-4 rounded border-gray-300"
          />
          Lleva control de inventario (genera kardex)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={values.activo}
            className="h-4 w-4 rounded border-gray-300"
          />
          Producto activo
        </label>
      </section>

      <SubmitButton icon={<Save size={16} />}>{submitLabel}</SubmitButton>
    </form>
  );
}

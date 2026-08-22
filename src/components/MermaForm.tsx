"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import SubmitButton from "./SubmitButton";
import ProductoCombobox from "./ProductoCombobox";
import { TIPOS_DEVOLUCION, TIPO_DEVOLUCION_LABEL } from "@/lib/devolucion-tipos";

type Producto = { id: string; nombre: string };
type Almacen = { id: string; nombre: string };

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

export default function MermaForm({
  action,
  error,
  productos,
  almacenes,
}: {
  action: (formData: FormData) => void;
  error?: string;
  productos: Producto[];
  // Solo se pasa (con al menos un local) cuando quien registra es
  // admin/logística — un vendedor tiene su almacén fijo y el servidor lo
  // asigna solo.
  almacenes?: Almacen[];
}) {
  const [productoId, setProductoId] = useState("");

  return (
    <form action={action} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <Field label="Producto">
        <ProductoCombobox
          productos={productos}
          value={productoId}
          onChange={setProductoId}
          name="producto_id"
          className={inputClass}
        />
      </Field>

      <Field label="Cantidad">
        <input
          type="number"
          step="0.01"
          min="0.01"
          name="cantidad"
          required
          className={inputClass}
        />
      </Field>

      <Field label="Causa">
        <select name="tipo" defaultValue="danado" className={inputClass}>
          {TIPOS_DEVOLUCION.map((t) => (
            <option key={t} value={t}>
              {TIPO_DEVOLUCION_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Detalle (opcional)">
        <input
          name="detalle"
          placeholder="Ej. se cayó la caja en el traslado..."
          className={inputClass}
        />
      </Field>

      {almacenes && almacenes.length > 0 && (
        <Field label="Almacén">
          <select name="almacen_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Selecciona un almacén
            </option>
            {almacenes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </Field>
      )}

      <SubmitButton icon={<Send size={16} />} pendingLabel="Registrando...">
        Registrar merma
      </SubmitButton>
    </form>
  );
}

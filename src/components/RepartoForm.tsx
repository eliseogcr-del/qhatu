"use client";

import { useState } from "react";
import {
  ESTADOS_REPARTO,
  ESTADO_REPARTO_LABEL,
  TIPOS_TRANSPORTE,
  TIPO_TRANSPORTE_LABEL,
} from "@/lib/reparto-estados";

type PedidoOption = { id: string; label: string };
type UsuarioOption = { id: string; nombre: string | null };

export type RepartoInitialValues = {
  pedido_id: string;
  fecha_reparto: string | null;
  tipo_transporte: string;
  transportista_nombre: string | null;
  repartidor_id: string | null;
  estado: string;
};

const emptyValues: RepartoInitialValues = {
  pedido_id: "",
  fecha_reparto: null,
  tipo_transporte: "repartidor_propio",
  transportista_nombre: null,
  repartidor_id: null,
  estado: "pendiente",
};

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

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

export default function RepartoForm({
  action,
  initialValues,
  error,
  submitLabel,
  pedidos,
  usuarios,
  pedidoFijo,
}: {
  action: (formData: FormData) => void;
  initialValues?: RepartoInitialValues;
  error?: string;
  submitLabel: string;
  pedidos: PedidoOption[];
  usuarios: UsuarioOption[];
  pedidoFijo?: boolean;
}) {
  const values = initialValues ?? emptyValues;
  const [tipoTransporte, setTipoTransporte] = useState(values.tipo_transporte);

  return (
    <form action={action} className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <Field label="Pedido">
        <select
          name={pedidoFijo ? undefined : "pedido_id"}
          required
          defaultValue={values.pedido_id}
          disabled={pedidoFijo}
          className={inputClass}
        >
          <option value="">Selecciona un pedido</option>
          {pedidos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        {pedidoFijo && (
          <input type="hidden" name="pedido_id" value={values.pedido_id} />
        )}
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fecha de reparto">
          <input
            type="date"
            name="fecha_reparto"
            defaultValue={values.fecha_reparto ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Estado">
          <select name="estado" defaultValue={values.estado} className={inputClass}>
            {ESTADOS_REPARTO.map((e) => (
              <option key={e} value={e}>
                {ESTADO_REPARTO_LABEL[e]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Tipo de transporte">
        <select
          name="tipo_transporte"
          value={tipoTransporte}
          onChange={(e) => setTipoTransporte(e.target.value)}
          className={inputClass}
        >
          {TIPOS_TRANSPORTE.map((t) => (
            <option key={t} value={t}>
              {TIPO_TRANSPORTE_LABEL[t]}
            </option>
          ))}
        </select>
      </Field>

      {tipoTransporte === "delivery_subcontratado" && (
        <Field label="Nombre del delivery / transportista">
          <input
            name="transportista_nombre"
            defaultValue={values.transportista_nombre ?? ""}
            className={inputClass}
          />
        </Field>
      )}

      {tipoTransporte === "repartidor_propio" && (
        <Field label="Repartidor">
          <select
            name="repartidor_id"
            defaultValue={values.repartidor_id ?? ""}
            className={inputClass}
          >
            <option value="">Selecciona un repartidor</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre ?? u.id}
              </option>
            ))}
          </select>
        </Field>
      )}

      <button
        type="submit"
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        {submitLabel}
      </button>
    </form>
  );
}

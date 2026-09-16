"use client";

import { useState } from "react";
import {
  ESTADOS_REPARTO,
  ESTADO_REPARTO_LABEL,
  TIPOS_TRANSPORTE,
  TIPO_TRANSPORTE_LABEL,
} from "@/lib/reparto-estados";
import SubmitButton from "./SubmitButton";

type PedidoOption = { id: string; label: string };
type UsuarioOption = { id: string; nombre: string | null };

export type RepartoInitialValues = {
  pedido_id: string;
  fecha_reparto: string | null;
  tipo_transporte: string;
  transportista_nombre: string | null;
  repartidor_id: string | null;
  estado: string;
  placaNumero: string | null;
  pesoBrutoTotal: number | null;
  numeroDeBultos: number | null;
  transportistaRuc: string | null;
};

const emptyValues: RepartoInitialValues = {
  pedido_id: "",
  fecha_reparto: null,
  tipo_transporte: "repartidor_propio",
  transportista_nombre: null,
  repartidor_id: null,
  estado: "pendiente",
  placaNumero: null,
  pesoBrutoTotal: null,
  numeroDeBultos: null,
  transportistaRuc: null,
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

      {(tipoTransporte === "repartidor_propio" || tipoTransporte === "vehiculo_cliente") && (
        <Field label="Repartidor / conductor">
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
          <p className="mt-1 text-xs text-gray-400">
            Necesario para declarar al conductor en la guía de remisión (transporte
            privado) — sus datos (DNI, licencia) se completan en Usuarios.
          </p>
        </Field>
      )}

      <section className="space-y-4 rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Datos para la guía de remisión (opcional)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Placa del vehículo">
            <input
              name="placa_numero"
              defaultValue={values.placaNumero ?? ""}
              placeholder="ABC123"
              className={inputClass}
            />
          </Field>
          <Field label="Peso bruto total (kg)">
            <input
              type="number"
              step="0.01"
              min="0"
              name="peso_bruto_total"
              defaultValue={values.pesoBrutoTotal ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="N° de bultos">
            <input
              type="number"
              step="1"
              min="1"
              name="numero_de_bultos"
              defaultValue={values.numeroDeBultos ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
        {tipoTransporte === "delivery_subcontratado" && (
          <Field label="RUC del transportista">
            <input
              name="transportista_ruc"
              defaultValue={values.transportistaRuc ?? ""}
              maxLength={11}
              className={inputClass}
            />
          </Field>
        )}
      </section>

      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

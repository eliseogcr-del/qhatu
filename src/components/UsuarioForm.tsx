"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { ROLES, ROL_LABEL, requiereAlmacen } from "@/lib/roles";
import SubmitButton from "./SubmitButton";

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

export type UsuarioInitialValues = {
  nombre: string;
  rol: string;
  activo: boolean;
  almacenId: string | null;
};

const emptyValues: UsuarioInitialValues = {
  nombre: "",
  rol: "vendedor",
  activo: true,
  almacenId: null,
};

export default function UsuarioForm({
  action,
  error,
  modo,
  initialValues,
  correoActual,
  submitLabel,
  almacenes,
}: {
  action: (formData: FormData) => void;
  error?: string;
  modo: "nuevo" | "editar";
  initialValues?: UsuarioInitialValues;
  correoActual?: string;
  submitLabel: string;
  almacenes: { id: string; nombre: string }[];
}) {
  const values = initialValues ?? emptyValues;
  const [rol, setRol] = useState(values.rol);

  return (
    <form action={action} className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {modo === "nuevo" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Correo electrónico">
            <input
              type="email"
              name="email"
              required
              autoComplete="off"
              className={inputClass}
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              name="password"
              required
              minLength={6}
              autoComplete="new-password"
              className={inputClass}
            />
          </Field>
        </div>
      ) : (
        <Field label="Correo electrónico">
          <input
            disabled
            value={correoActual ?? ""}
            className={`${inputClass} bg-gray-50 text-gray-500`}
          />
        </Field>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre">
          <input
            name="nombre"
            required
            defaultValue={values.nombre}
            className={inputClass}
          />
        </Field>
        <Field label="Perfil">
          <select
            name="rol"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className={inputClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROL_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {requiereAlmacen(rol) && (
        <Field label="Almacén / Local">
          <select
            name="almacen_id"
            required
            defaultValue={values.almacenId ?? ""}
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
          <p className="mt-1 text-xs text-gray-400">
            Sus pedidos/ventas/compras quedarán amarrados a este almacén y
            solo verá lo de ese local.
          </p>
        </Field>
      )}

      {rol === "logistica" && (
        <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
          Logística ve y opera en Reparto, Traslados, Abastecimiento en
          campo, Inventario y Kardex de todos los almacenes — no entra a
          Usuarios, Facturación ni Auditoría.
        </p>
      )}

      {rol === "repartidor" && (
        <p className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
          Repartidor solo ve y actualiza el estado de los repartos que se le
          asignen — no accede a ventas, compras, inventario ni al resto del
          sistema.
        </p>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={values.activo}
          className="h-4 w-4 rounded border-gray-300"
        />
        Usuario activo
      </label>

      <SubmitButton icon={<Save size={16} />}>{submitLabel}</SubmitButton>
    </form>
  );
}

import { Save } from "lucide-react";
import SubmitButton from "./SubmitButton";

export type ProveedorInitialValues = {
  nombre: string;
  ruc: string | null;
  contacto: string | null;
  telefono: string | null;
  correo_electronico: string | null;
  activo: boolean;
};

const emptyValues: ProveedorInitialValues = {
  nombre: "",
  ruc: null,
  contacto: null,
  telefono: null,
  correo_electronico: null,
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

export default function ProveedorForm({
  action,
  initialValues,
  error,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  initialValues?: ProveedorInitialValues;
  error?: string;
  submitLabel: string;
}) {
  const values = initialValues ?? emptyValues;

  return (
    <form action={action} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nombre / Razón social">
          <input
            name="nombre"
            required
            defaultValue={values.nombre}
            className={inputClass}
          />
        </Field>
        <Field label="RUC">
          <input
            name="ruc"
            defaultValue={values.ruc ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Persona de contacto">
          <input
            name="contacto"
            defaultValue={values.contacto ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Teléfono">
          <input
            name="telefono"
            defaultValue={values.telefono ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Correo electrónico">
          <input
            type="email"
            name="correo_electronico"
            defaultValue={values.correo_electronico ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={values.activo}
          className="h-4 w-4 rounded border-gray-300"
        />
        Proveedor activo
      </label>

      <SubmitButton icon={<Save size={16} />}>{submitLabel}</SubmitButton>
    </form>
  );
}

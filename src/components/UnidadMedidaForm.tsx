import { Save } from "lucide-react";
import SubmitButton from "./SubmitButton";

export type UnidadMedidaInitialValues = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  activo: boolean;
};

const emptyValues: UnidadMedidaInitialValues = {
  codigo: "",
  descripcion: "",
  cantidad: 1,
  activo: true,
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
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

export default function UnidadMedidaForm({
  action,
  error,
  initialValues,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  error?: string;
  initialValues?: UnidadMedidaInitialValues;
  submitLabel: string;
}) {
  const values = initialValues ?? emptyValues;

  return (
    <form action={action} className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Código">
          <input
            name="codigo"
            required
            defaultValue={values.codigo}
            placeholder="Ej. UND, DOC"
            className={inputClass}
          />
        </Field>
        <Field label="Descripción">
          <input
            name="descripcion"
            required
            defaultValue={values.descripcion}
            placeholder="Ej. UNIDAD, DOCENA"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Cantidad (equivalencia en unidades base)">
        <input
          type="number"
          step="0.01"
          min="0.01"
          name="cantidad"
          required
          defaultValue={values.cantidad || ""}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-gray-400">
          Cuántas unidades sueltas representa esta medida — ej. DOCENA = 12.
          La unidad base (UNIDAD) siempre vale 1.
        </p>
      </Field>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={values.activo}
          className="h-4 w-4 rounded border-gray-300"
        />
        Unidad activa
      </label>

      <SubmitButton icon={<Save size={16} />}>{submitLabel}</SubmitButton>
    </form>
  );
}

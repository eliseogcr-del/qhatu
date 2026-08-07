import { Save } from "lucide-react";
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
          <select name="rol" defaultValue={values.rol} className={inputClass}>
            <option value="vendedor">Vendedor</option>
            <option value="admin">Administrador</option>
          </select>
        </Field>
      </div>

      <Field label="Almacén / Local">
        <select
          name="almacen_id"
          defaultValue={values.almacenId ?? ""}
          className={inputClass}
        >
          <option value="">Todos los locales (solo Administrador)</option>
          {almacenes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">
          Si el perfil es Vendedor, sus pedidos/ventas/compras quedarán
          amarrados a este almacén y solo verá lo de ese local.
        </p>
      </Field>

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

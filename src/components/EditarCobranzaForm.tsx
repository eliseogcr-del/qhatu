import { METODOS_PAGO, METODO_PAGO_LABEL } from "@/lib/cobranza-tipos";
import SubmitButton from "./SubmitButton";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-500 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  );
}

export default function EditarCobranzaForm({
  action,
  error,
  clienteNombre,
  saldoDisponible,
  valoresIniciales,
}: {
  action: (formData: FormData) => void;
  error?: string;
  clienteNombre: string;
  // null cuando el cobro no está atado a una venta (anticipo sobre
  // pedido) — ahí no hay un tope de saldo que respetar.
  saldoDisponible: number | null;
  valoresIniciales: {
    fecha: string;
    monto: number;
    moneda: string;
    tipoCambioAplicado: number;
    metodoPago: string;
    referencia: string;
  };
}) {
  return (
    <form action={action} className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div>
        <p className="text-sm text-gray-500">Cliente</p>
        <p className="font-medium text-gray-900">{clienteNombre}</p>
        {saldoDisponible != null && (
          <p className="mt-1 text-sm text-gray-500">
            Saldo disponible para este cobro (sin contar el monto actual): {valoresIniciales.moneda}{" "}
            {saldoDisponible.toFixed(2)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Fecha del cobro">
          <input
            type="datetime-local"
            name="fecha"
            required
            defaultValue={valoresIniciales.fecha}
            className={inputClass}
          />
        </Field>
        <Field label="Monto">
          <input
            type="number"
            step="0.01"
            min="0.01"
            name="monto"
            required
            defaultValue={valoresIniciales.monto}
            className={inputClass}
          />
        </Field>
        <Field label="Moneda">
          <select name="moneda" defaultValue={valoresIniciales.moneda} className={inputClass}>
            <option value="PEN">Soles (PEN)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </Field>
        <Field label="Tipo de cambio aplicado">
          <input
            type="number"
            step="0.0001"
            name="tipo_cambio_aplicado"
            required
            defaultValue={valoresIniciales.tipoCambioAplicado}
            className={inputClass}
          />
        </Field>
        <Field label="Método de pago">
          <select name="metodo_pago" defaultValue={valoresIniciales.metodoPago} className={inputClass}>
            {METODOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {METODO_PAGO_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Referencia (N° de operación, etc.)">
        <input name="referencia" defaultValue={valoresIniciales.referencia} className={inputClass} />
      </Field>

      <SubmitButton pendingLabel="Guardando...">Guardar cambios</SubmitButton>
    </form>
  );
}

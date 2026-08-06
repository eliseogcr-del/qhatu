import { METODOS_PAGO, METODO_PAGO_LABEL } from "@/lib/cobranza-tipos";
import SubmitButton from "./SubmitButton";
import EvidenciaPagoInput from "./EvidenciaPagoInput";

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

export default function CobranzaForm({
  action,
  error,
  pedidoId,
  clienteNombre,
  monedaSugerida,
  saldoPendiente,
  almacenamientoBloqueado,
  almacenamientoAviso,
}: {
  action: (formData: FormData) => void;
  error?: string;
  pedidoId: string;
  clienteNombre: string;
  monedaSugerida: string;
  saldoPendiente: number | null;
  almacenamientoBloqueado?: boolean;
  almacenamientoAviso?: boolean;
}) {
  return (
    <form action={action} className="space-y-6">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <input type="hidden" name="pedido_id" value={pedidoId} />

      <div>
        <p className="text-sm text-gray-500">Cliente</p>
        <p className="font-medium text-gray-900">{clienteNombre}</p>
        {saldoPendiente != null && (
          <p className="mt-1 text-sm text-gray-500">
            Saldo pendiente: {monedaSugerida} {saldoPendiente.toFixed(2)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Monto">
          <input
            type="number"
            step="0.01"
            min="0.01"
            max={
              saldoPendiente != null && saldoPendiente > 0
                ? saldoPendiente.toFixed(2)
                : undefined
            }
            name="monto"
            required
            defaultValue={saldoPendiente != null && saldoPendiente > 0 ? saldoPendiente.toFixed(2) : ""}
            className={inputClass}
          />
        </Field>
        <Field label="Moneda">
          <select name="moneda" defaultValue={monedaSugerida} className={inputClass}>
            <option value="PEN">Soles (PEN)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </Field>
        <Field label="Tipo de cambio aplicado">
          <input
            type="number"
            step="0.0001"
            name="tipo_cambio_aplicado"
            defaultValue={1}
            className={inputClass}
          />
        </Field>
        <Field label="Método de pago">
          <select name="metodo_pago" defaultValue="efectivo" className={inputClass}>
            {METODOS_PAGO.map((m) => (
              <option key={m} value={m}>
                {METODO_PAGO_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Referencia (N° de operación, etc.)">
        <input name="referencia" className={inputClass} />
      </Field>

      <Field label="Evidencia de pago (foto del Yape/Plin/etc.)">
        {almacenamientoBloqueado ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Se alcanzó el límite de almacenamiento de imágenes. Este cobro se
            puede registrar igual, pero sin foto — un administrador debe
            liberar espacio desde &quot;Evidencias de pago&quot;.
          </p>
        ) : (
          <EvidenciaPagoInput aviso={almacenamientoAviso} />
        )}
      </Field>

      <SubmitButton pendingLabel="Registrando cobro...">
        Registrar cobro
      </SubmitButton>
    </form>
  );
}

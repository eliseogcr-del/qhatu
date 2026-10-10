"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import SubmitButton from "./SubmitButton";

export default function ObjetivosMetaForm({
  action,
  periodo,
  vendedorId,
  modo,
  metaActual,
  etiqueta,
}: {
  action: (formData: FormData) => void;
  periodo: string;
  vendedorId: string;
  modo: string;
  metaActual: number;
  etiqueta: string;
}) {
  const [monto, setMonto] = useState(metaActual > 0 ? String(metaActual) : "");

  return (
    <form
      action={action}
      className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
    >
      <input type="hidden" name="periodo" value={periodo} />
      <input type="hidden" name="vendedor_id" value={vendedorId} />
      <input type="hidden" name="modo" value={modo} />
      <div className="flex items-center gap-2 text-amber-800">
        <Target size={18} />
        <span className="text-sm font-medium">Meta de {etiqueta} para este período</span>
      </div>
      <div>
        <input
          type="number"
          name="monto"
          min="0"
          step="0.01"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="0.00"
          className="w-32 rounded-lg border border-amber-300 px-3 py-2 text-sm"
          required
        />
      </div>
      <SubmitButton
        pendingLabel="Guardando..."
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
      >
        Guardar meta
      </SubmitButton>
    </form>
  );
}

"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

// Envoltorio genérico para una tarjeta con título que se puede
// abrir/cerrar — la "acción" (un botón/link del encabezado, ej.
// "Registrar cobro") va fuera del botón de colapsar para no anidar
// elementos interactivos uno dentro de otro.
export default function SeccionColapsable({
  titulo,
  accion,
  defaultAbierto = false,
  children,
}: {
  titulo: React.ReactNode;
  accion?: React.ReactNode;
  defaultAbierto?: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(defaultAbierto);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 px-6 py-4">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left text-sm font-semibold uppercase tracking-wide text-gray-500"
        >
          {titulo}
        </button>
        <div className="flex items-center gap-3">
          {accion}
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-label={abierto ? "Colapsar" : "Expandir"}
            className="text-gray-400 hover:text-gray-600"
          >
            {abierto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>
      {abierto && <div className="border-t border-gray-100 p-6 pt-4">{children}</div>}
    </div>
  );
}

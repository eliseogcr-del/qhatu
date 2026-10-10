"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

// Los enlaces "Exportar a Excel" son <a href> normales a una ruta que
// responde con Content-Disposition: attachment — la página nunca navega
// ni se desmonta, así que sin esto un click no cambiaba nada a la vista
// y daba pie a hacer click varias veces pensando que no había pasado
// nada. Igual que GetSubmitButton, se controla el estado "ocupado" a
// mano (con un timeout, no hay una respuesta real que esperar) y se
// reactiva solo pasado un rato.
export default function ExportLinkButton({
  href,
  children,
  icon,
  pendingLabel = "Descargando...",
  pendingMs = 2500,
  className,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  pendingLabel?: string;
  // Más alto para descargas que de verdad tardan (ej. el ZIP de
  // respaldo armando un Excel por tabla) — que no se note sin razón el
  // doble de tiempo real.
  pendingMs?: number;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <a
      href={href}
      aria-busy={pending}
      onClick={() => {
        setPending(true);
        setTimeout(() => setPending(false), pendingMs);
      }}
      className={
        (className ??
          "flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50") +
        (pending ? " pointer-events-none opacity-70" : "")
      }
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : icon}
      {pending ? pendingLabel : children}
    </a>
  );
}

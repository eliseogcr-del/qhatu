"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

// Para el único caso de botón "submit" dentro de un <form method="GET">
// apuntando a una URL en vez de una server action — useFormStatus (el que
// usa SubmitButton) no detecta esa navegación nativa, así que acá se
// controla el estado "ocupado" a mano. Como esto dispara una descarga de
// archivo (Content-Disposition: attachment) la página nunca navega ni se
// desmonta, así que no hay otro momento para "soltar" el botón — se
// reactiva solo pasado un rato, el tiempo justo para que se note que el
// click sí hizo algo.
export default function GetSubmitButton({
  children,
  pendingLabel,
  icon,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={() => {
        setPending(true);
        setTimeout(() => setPending(false), 2500);
      }}
      className={
        (className ??
          "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700") +
        " flex items-center gap-2 disabled:cursor-wait disabled:opacity-70"
      }
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : icon}
      {pending ? (pendingLabel ?? "Procesando...") : children}
    </button>
  );
}

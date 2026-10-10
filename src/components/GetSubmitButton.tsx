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
//
// A propósito NO se usa el atributo `disabled`: React lo aplica casi en
// el mismo tick del click, y en un <button type="submit"> eso puede
// ganarle de carrera al envío nativo del formulario — el botón queda
// deshabilitado antes de que el navegador llegue a disparar el submit, y
// la descarga nunca sale. El aviso visual (ícono + texto) alcanza sin
// arriesgar que el click deje de funcionar.
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
      aria-busy={pending}
      onClick={() => {
        setPending(true);
        setTimeout(() => setPending(false), 2500);
      }}
      className={
        (className ??
          "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700") +
        " flex items-center gap-2"
      }
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : icon}
      {pending ? (pendingLabel ?? "Procesando...") : children}
    </button>
  );
}

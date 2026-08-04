"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

export default function SubmitButton({
  children,
  pendingLabel,
  icon,
  className,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  // Un elemento ya renderizado (ej. <Save size={16} />), nunca el
  // componente en sí — pasar el componente cruza el límite Server/Client
  // como una referencia de función, lo cual React no permite serializar.
  icon?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={
        (className ??
          "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700") +
        " flex items-center gap-2 disabled:cursor-wait disabled:opacity-70"
      }
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : icon}
      {pending ? (pendingLabel ?? "Guardando...") : children}
    </button>
  );
}

"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";
import { comprimirImagen } from "@/lib/comprimir-imagen";

export default function ReemplazarEvidenciaCobranza({
  action,
  tieneEvidencia,
  urlVerEvidencia,
}: {
  action: (formData: FormData) => void;
  tieneEvidencia: boolean;
  urlVerEvidencia?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [procesando, setProcesando] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (procesando) return;
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    setProcesando(true);
    const comprimido = await comprimirImagen(archivo);

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(comprimido);
    if (inputRef.current) inputRef.current.files = dataTransfer.files;

    // Un input deshabilitado no envía su valor al enviar el formulario —
    // por eso `procesando` solo controla el label (texto/cursor), nunca el
    // atributo `disabled` del input real.
    formRef.current?.requestSubmit();
  };

  return (
    <div className="flex flex-col items-start gap-1">
      {urlVerEvidencia && (
        <a
          href={urlVerEvidencia}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-emerald-700 hover:underline"
        >
          Ver evidencia
        </a>
      )}
      <form ref={formRef} action={action}>
        <label
          className={`flex cursor-pointer items-center gap-1 text-xs font-medium ${
            procesando
              ? "cursor-wait text-gray-400"
              : "text-gray-600 hover:underline"
          }`}
        >
          {procesando ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Paperclip size={12} />
          )}
          {procesando ? "Subiendo..." : tieneEvidencia ? "Reemplazar" : "Subir evidencia"}
          <input
            ref={inputRef}
            type="file"
            name="evidencia"
            accept="image/*"
            onChange={handleChange}
            className="hidden"
          />
        </label>
      </form>
    </div>
  );
}

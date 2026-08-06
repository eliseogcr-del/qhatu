"use client";

import { useRef, useState } from "react";
import { Paperclip, Loader2 } from "lucide-react";

const ANCHO_MAXIMO = 1280;
const CALIDAD_JPEG = 0.75;

async function comprimirImagen(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, ANCHO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * escala);
    const height = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", CALIDAD_JPEG),
    );
    if (!blob) return file;

    const nombre = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export default function EvidenciaPagoInput({ aviso }: { aviso?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [procesando, setProcesando] = useState(false);
  const [resumen, setResumen] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const seleccionados = Array.from(e.target.files ?? []);
    if (seleccionados.length === 0) {
      setResumen(null);
      return;
    }

    setProcesando(true);
    const comprimidas = await Promise.all(seleccionados.map(comprimirImagen));
    setProcesando(false);

    const dataTransfer = new DataTransfer();
    comprimidas.forEach((f) => dataTransfer.items.add(f));
    if (inputRef.current) {
      inputRef.current.files = dataTransfer.files;
    }

    const totalKB = comprimidas.reduce((acc, f) => acc + f.size, 0) / 1024;
    setResumen(
      `${comprimidas.length} imagen${comprimidas.length === 1 ? "" : "es"} lista${
        comprimidas.length === 1 ? "" : "s"
      } (${totalKB.toFixed(0)} KB)`,
    );
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Paperclip size={16} className="shrink-0 text-gray-400" />
        <input
          ref={inputRef}
          type="file"
          name="evidencias"
          multiple
          accept="image/*"
          disabled={procesando}
          onChange={handleChange}
          className="block w-full text-sm text-gray-600"
        />
      </div>
      {procesando && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
          <Loader2 size={14} className="animate-spin" />
          Comprimiendo imágenes...
        </p>
      )}
      {!procesando && resumen && (
        <p className="mt-2 text-sm text-emerald-600">{resumen}</p>
      )}
      {aviso && (
        <p className="mt-2 text-sm text-amber-600">
          El almacenamiento de imágenes está por llenarse — pronto un
          administrador tendrá que liberar espacio.
        </p>
      )}
    </div>
  );
}

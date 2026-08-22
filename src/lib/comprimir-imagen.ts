const ANCHO_MAXIMO = 1280;
const CALIDAD_JPEG = 0.75;

// Comprime a JPEG antes de subir — las fotos de un celular fácilmente pesan
// varios MB, y el plan free de Supabase Storage es de solo 1GB compartido
// entre pedidos y cobranzas.
export async function comprimirImagen(file: File): Promise<File> {
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

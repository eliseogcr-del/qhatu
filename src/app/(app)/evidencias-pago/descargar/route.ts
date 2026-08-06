import JSZip from "jszip";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";

export async function GET() {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const { data: adjuntos } = await supabase
    .from("cobranza_adjuntos")
    .select("storage_path, nombre_archivo")
    .eq("empresa_id", empresaId)
    .not("storage_path", "is", null);

  if (!adjuntos || adjuntos.length === 0) {
    return new NextResponse("No hay imágenes en la nube para descargar.", {
      status: 404,
    });
  }

  const zip = new JSZip();

  for (const adjunto of adjuntos) {
    const { data: blob } = await supabase.storage
      .from("cobranza-adjuntos")
      .download(adjunto.storage_path as string);

    if (blob) {
      zip.file(adjunto.nombre_archivo, await blob.arrayBuffer());
    }
  }

  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  const zipBuffer = zipBytes.buffer.slice(
    zipBytes.byteOffset,
    zipBytes.byteOffset + zipBytes.byteLength,
  ) as ArrayBuffer;

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="evidencias-pago-qhatu.zip"',
    },
  });
}

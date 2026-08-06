"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import { buildRutaLocal } from "@/lib/cobranza-adjuntos";

// Borra de Storage todo lo que siga en la nube y deja constancia de que
// quedó archivado localmente — nunca borra la fila (auditoría de que el
// comprobante existió), solo el archivo pesado.
export async function confirmarLiberarEspacio() {
  const supabase = await createClient();
  const { userId, empresaId } = await requireAdmin(supabase);

  const { data: adjuntos } = await supabase
    .from("cobranza_adjuntos")
    .select("id, storage_path, nombre_archivo")
    .eq("empresa_id", empresaId)
    .not("storage_path", "is", null);

  if (!adjuntos || adjuntos.length === 0) {
    revalidatePath("/evidencias-pago");
    return;
  }

  const paths = adjuntos.map((a) => a.storage_path as string);
  await supabase.storage.from("cobranza-adjuntos").remove(paths);

  const ahora = new Date().toISOString();
  await Promise.all(
    adjuntos.map((a) =>
      supabase
        .from("cobranza_adjuntos")
        .update({
          storage_path: null,
          ruta_local: buildRutaLocal(a.nombre_archivo),
          archivado_en: ahora,
          archivado_por: userId,
        })
        .eq("id", a.id),
    ),
  );

  revalidatePath("/evidencias-pago");
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";

export async function guardarConfiguracionCotizaciones(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const numeroInicial = Number(formData.get("numero_inicial") || 1);

  if (!(numeroInicial > 0)) {
    redirect(
      `/configuracion-cotizaciones?error=${encodeURIComponent("El número inicial debe ser mayor a 0.")}`,
    );
  }

  const { error } = await supabase.from("configuracion_cotizaciones").upsert(
    {
      empresa_id: empresaId,
      numero_inicial: numeroInicial,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id" },
  );

  if (error) {
    redirect(`/configuracion-cotizaciones?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/configuracion-cotizaciones");
  redirect("/configuracion-cotizaciones?guardado=1");
}

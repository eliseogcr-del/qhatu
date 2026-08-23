"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";

export async function guardarConfiguracionCotizaciones(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const numeroInicial = Number(formData.get("numero_inicial") || 1);
  const porcentajeIgv = Number(formData.get("porcentaje_igv") || 0);

  if (!(numeroInicial > 0)) {
    redirect(
      `/configuracion-cotizaciones?error=${encodeURIComponent("El número inicial debe ser mayor a 0.")}`,
    );
  }
  if (!(porcentajeIgv >= 0)) {
    redirect(
      `/configuracion-cotizaciones?error=${encodeURIComponent("El porcentaje de impuesto no puede ser negativo.")}`,
    );
  }

  const { error } = await supabase.from("configuracion_cotizaciones").upsert(
    {
      empresa_id: empresaId,
      numero_inicial: numeroInicial,
      porcentaje_igv: porcentajeIgv,
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

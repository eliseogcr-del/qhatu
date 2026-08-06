"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";

export async function guardarConfiguracionFacturacion(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const serieFactura = String(formData.get("serie_factura") ?? "").trim().toUpperCase();
  const serieBoleta = String(formData.get("serie_boleta") ?? "").trim().toUpperCase();

  if (!serieFactura || !serieBoleta) {
    redirect(
      `/configuracion-facturacion?error=${encodeURIComponent("Completa ambas series.")}`,
    );
  }

  const { error } = await supabase.from("configuracion_facturacion").upsert(
    {
      empresa_id: empresaId,
      serie_factura: serieFactura,
      serie_boleta: serieBoleta,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id" },
  );

  if (error) {
    redirect(`/configuracion-facturacion?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/configuracion-facturacion");
  redirect("/configuracion-facturacion?guardado=1");
}

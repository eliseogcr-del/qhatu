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

// La serie de nota de venta es por almacén (no por empresa como
// factura/boleta) — se leen los almacenes desde la BD en vez de confiar
// en una lista que venga del formulario, así el usuario no puede inyectar
// un almacen_id ajeno a su empresa.
export async function guardarSeriesNotaVenta(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const { data: almacenes } = await supabase
    .from("almacenes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("activo", true);

  const filas = (almacenes ?? [])
    .map((a) => ({
      almacen_id: a.id,
      serie: String(formData.get(`serie_${a.id}`) ?? "").trim().toUpperCase(),
      updated_at: new Date().toISOString(),
    }))
    .filter((f) => f.serie);

  if (filas.length === 0) {
    redirect(
      `/configuracion-facturacion?error=${encodeURIComponent("No hay series de nota de venta para guardar.")}`,
    );
  }

  const { error } = await supabase
    .from("series_nota_venta")
    .upsert(filas, { onConflict: "almacen_id" });

  if (error) {
    redirect(`/configuracion-facturacion?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/configuracion-facturacion");
  redirect("/configuracion-facturacion?guardado=1");
}

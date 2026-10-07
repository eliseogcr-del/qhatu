"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";

function volverConError(periodo: string, vendedorId: string, modo: string, mensaje: string): never {
  const usp = new URLSearchParams({ periodo, vendedor_id: vendedorId, modo, error: mensaje });
  redirect(`/reportes/objetivos?${usp.toString()}`);
}

export async function guardarMetaVentas(formData: FormData) {
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const periodo = String(formData.get("periodo") || "");
  const vendedorId = String(formData.get("vendedor_id") || "");
  const modo = String(formData.get("modo") || "cobrado");
  const monto = Number(formData.get("monto"));

  if (!/^\d{4}-\d{2}$/.test(periodo)) {
    volverConError(periodo, vendedorId, modo, "Período inválido.");
  }
  if (!(monto >= 0)) {
    volverConError(periodo, vendedorId, modo, "La meta debe ser un número mayor o igual a 0.");
  }

  const { error } = await supabase.from("metas_ventas").upsert(
    {
      empresa_id: empresaId,
      periodo: `${periodo}-01`,
      vendedor_id: vendedorId || null,
      monto,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id,periodo,vendedor_clave" },
  );

  if (error) {
    volverConError(periodo, vendedorId, modo, error.message);
  }

  revalidatePath("/reportes/objetivos");
  const usp = new URLSearchParams({ periodo, vendedor_id: vendedorId, modo, guardado: "1" });
  redirect(`/reportes/objetivos?${usp.toString()}`);
}

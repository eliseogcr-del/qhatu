"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession, resolverAlmacenId } from "@/utils/supabase/session";
import { registrarMovimientoKardex, validarStockDisponible } from "@/utils/supabase/kardex";
import { TIPOS_DEVOLUCION, TIPO_DEVOLUCION_LABEL, type TipoDevolucion } from "@/lib/devolucion-tipos";

// Merma directa: producto que se malogró/venció/dañó fuera de una venta
// (ej. revisando el almacén). Fecha y usuario quedan registrados solos
// (kardex_movimientos ya los guarda en cada fila) — acá solo hace falta
// resolver el almacén y dejar la causa en el detalle.
export async function registrarMermaDirecta(formData: FormData) {
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);
  const { userId, empresaId } = session;

  const almacenId = resolverAlmacenId(session, formData);
  if (!almacenId) {
    redirect(`/kardex/merma?error=${encodeURIComponent("Selecciona el almacén afectado.")}`);
  }

  const productoId = String(formData.get("producto_id") ?? "");
  const cantidad = Number(formData.get("cantidad") ?? 0);
  const tipoRaw = String(formData.get("tipo") ?? "");
  const tipo = (TIPOS_DEVOLUCION as readonly string[]).includes(tipoRaw)
    ? (tipoRaw as TipoDevolucion)
    : "otro";
  const detalleLibre = String(formData.get("detalle") ?? "").trim();

  if (!productoId || !(cantidad > 0)) {
    redirect(
      `/kardex/merma?error=${encodeURIComponent("Selecciona un producto y una cantidad mayor a 0.")}`,
    );
  }

  const { data: producto } = await supabase
    .from("productos")
    .select("id, nombre, control_inventario")
    .eq("id", productoId)
    .single();

  if (!producto) {
    redirect(`/kardex/merma?error=${encodeURIComponent("El producto seleccionado no existe.")}`);
  }
  if (!producto.control_inventario) {
    redirect(
      `/kardex/merma?error=${encodeURIComponent("Ese producto no lleva control de inventario.")}`,
    );
  }

  const errorStock = await validarStockDisponible(supabase, almacenId, [
    { productoId, productoNombre: producto.nombre, cantidad },
  ]);
  if (errorStock) {
    redirect(`/kardex/merma?error=${encodeURIComponent(errorStock)}`);
  }

  const detalle = `${TIPO_DEVOLUCION_LABEL[tipo]}${detalleLibre ? ` — ${detalleLibre}` : ""}`;

  await registrarMovimientoKardex(supabase, {
    empresaId,
    productoId,
    almacenId,
    tipoMovimiento: "merma",
    cantidad: -cantidad,
    detalle,
    usuarioId: userId,
  });

  revalidatePath("/kardex");
  revalidatePath("/inventario");
  redirect("/kardex");
}

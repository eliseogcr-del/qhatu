"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getEmpresaSession, requireAdmin } from "@/utils/supabase/session";
import { registrarMovimientosKardex, validarStockDisponible } from "@/utils/supabase/kardex";
import { formatFechaHora } from "@/lib/fecha";

// Traslado entre almacenes (ej. carga inicial de un vendedor antes de salir
// a ruta, o el retorno de lo no vendido). Genera SIEMPRE los dos lados del
// movimiento juntos (salida en origen + entrada en destino), nunca por
// separado, para que nunca queden descuadrados entre sí.
export async function createTraslado(formData: FormData) {
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);
  const { userId, empresaId, rol, almacenId } = session;

  const almacenOrigenId = String(formData.get("almacen_origen_id") ?? "");
  const almacenDestinoId = String(formData.get("almacen_destino_id") ?? "");
  const nota = String(formData.get("nota") ?? "").trim() || null;

  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);

  const lineas = productoIds
    .map((producto_id, i) => ({ producto_id, cantidad: cantidades[i] }))
    .filter((l) => l.producto_id);

  if (!almacenOrigenId || !almacenDestinoId) {
    redirect(
      `/traslados/nuevo?error=${encodeURIComponent("Selecciona el almacén de origen y el de destino.")}`,
    );
  }
  if (almacenOrigenId === almacenDestinoId) {
    redirect(
      `/traslados/nuevo?error=${encodeURIComponent("El origen y el destino no pueden ser el mismo almacén.")}`,
    );
  }
  if (lineas.length === 0) {
    redirect(`/traslados/nuevo?error=${encodeURIComponent("Agrega al menos un producto.")}`);
  }
  if (lineas.some((l) => !(l.cantidad > 0))) {
    redirect(
      `/traslados/nuevo?error=${encodeURIComponent("Cada producto debe tener una cantidad mayor a 0.")}`,
    );
  }

  const productoIdsUnicos = new Set(lineas.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineas.length) {
    redirect(
      `/traslados/nuevo?error=${encodeURIComponent("Hay un producto repetido. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  // Admin y logística mueven mercadería entre almacenes libremente
  // (cualquier origen, cualquier destino) — logística no tiene almacén
  // fijo propio, igual que en inventario/kardex/repartos. Un vendedor sí
  // tiene almacén fijo y solo puede ENVIAR desde el suyo hacia otro, nunca
  // recibir ni mover entre dos almacenes que no sean el suyo.
  if (rol !== "admin" && rol !== "logistica" && almacenId !== almacenOrigenId) {
    redirect(
      `/traslados/nuevo?error=${encodeURIComponent("Solo puedes enviar mercadería desde tu propio almacén.")}`,
    );
  }

  const { data: productosInfo } = await supabase
    .from("productos")
    .select("id, nombre, control_inventario")
    .in("id", [...productoIdsUnicos]);

  const lineasConControl = lineas
    .map((l) => {
      const producto = productosInfo?.find((p) => p.id === l.producto_id);
      return {
        productoId: l.producto_id,
        productoNombre: producto?.nombre ?? l.producto_id,
        cantidad: l.cantidad,
        controlInventario: producto?.control_inventario,
      };
    })
    .filter((l) => l.controlInventario);

  const errorStock = await validarStockDisponible(
    supabase,
    almacenOrigenId,
    lineasConControl,
  );
  if (errorStock) {
    redirect(`/traslados/nuevo?error=${encodeURIComponent(errorStock)}`);
  }

  const { data: traslado, error: trasladoError } = await supabase
    .from("traslados")
    .insert({
      empresa_id: empresaId,
      almacen_origen_id: almacenOrigenId,
      almacen_destino_id: almacenDestinoId,
      usuario_id: userId,
      nota,
    })
    .select("id")
    .single();

  if (trasladoError || !traslado) {
    redirect(
      `/traslados/nuevo?error=${encodeURIComponent(trasladoError?.message ?? "No se pudo registrar el traslado.")}`,
    );
  }

  const { data: detalleRows, error: detalleError } = await supabase
    .from("traslado_detalle")
    .insert(
      lineas.map((l) => ({
        traslado_id: traslado.id,
        producto_id: l.producto_id,
        cantidad: l.cantidad,
      })),
    )
    .select("id, producto_id, cantidad");

  if (detalleError || !detalleRows) {
    redirect(
      `/traslados/nuevo?error=${encodeURIComponent(detalleError?.message ?? "No se pudo registrar el detalle del traslado.")}`,
    );
  }

  const movimientos: Parameters<typeof registrarMovimientosKardex>[3] = [];
  for (const row of detalleRows) {
    const llevaInventario = productosInfo?.find(
      (p) => p.id === row.producto_id,
    )?.control_inventario;
    if (!llevaInventario) continue;

    movimientos.push({
      productoId: row.producto_id,
      almacenId: almacenOrigenId,
      tipoMovimiento: "traslado_salida",
      cantidad: -row.cantidad,
      referenciaId: row.id,
      detalle: nota,
    });
    movimientos.push({
      productoId: row.producto_id,
      almacenId: almacenDestinoId,
      tipoMovimiento: "traslado_entrada",
      cantidad: row.cantidad,
      referenciaId: row.id,
      detalle: nota,
    });
  }

  // Se escribe con el cliente admin (service_role): un vendedor puede
  // necesitar tocar el stock del almacén principal (el lado del traslado
  // que no es el suyo), algo que su propia sesión no puede hacer vía RLS.
  // La autorización ya se validó arriba (admin o dueño de origen/destino),
  // así que el bypass de RLS acá es seguro.
  const admin = createAdminClient();
  await registrarMovimientosKardex(admin, empresaId, userId, movimientos);

  revalidatePath("/traslados");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  redirect("/traslados");
}

// Corrige un traslado que se registró por error y la mercadería nunca se
// movió físicamente (ej. la precarga de stock se envió sin querer): genera
// el traslado inverso exacto (mismo producto y cantidad, origen/destino
// invertidos) en vez de borrar o editar el original — así ambos quedan en
// el historial y el kardex nunca pierde su trazabilidad. Solo admin, porque
// mueve stock entre almacenes que no necesariamente son los suyos.
export async function revertirTraslado(trasladoId: string) {
  const supabase = await createClient();
  const { userId, empresaId } = await requireAdmin(supabase);

  const { data: original, error: originalError } = await supabase
    .from("traslados")
    .select(
      "id, fecha, almacen_origen_id, almacen_destino_id, traslado_detalle(id, producto_id, cantidad)",
    )
    .eq("id", trasladoId)
    .single();

  if (originalError || !original) {
    redirect(`/traslados?error=${encodeURIComponent("No se encontró el traslado a revertir.")}`);
  }

  const lineasOriginales = original.traslado_detalle as unknown as {
    id: string;
    producto_id: string;
    cantidad: number;
  }[];

  if (lineasOriginales.length === 0) {
    redirect(`/traslados?error=${encodeURIComponent("Ese traslado no tiene productos que revertir.")}`);
  }

  // El nuevo origen es el destino original — hay que confirmar que ahí sí
  // hay stock suficiente para devolverlo (puede que ya se haya usado/vendido
  // parte de lo que entró de más).
  const productoIds = lineasOriginales.map((l) => l.producto_id);
  const { data: productosInfo } = await supabase
    .from("productos")
    .select("id, nombre, control_inventario")
    .in("id", productoIds);

  const lineasConControl = lineasOriginales
    .map((l) => {
      const producto = productosInfo?.find((p) => p.id === l.producto_id);
      return {
        productoId: l.producto_id,
        productoNombre: producto?.nombre ?? l.producto_id,
        cantidad: l.cantidad,
        controlInventario: producto?.control_inventario,
      };
    })
    .filter((l) => l.controlInventario);

  const errorStock = await validarStockDisponible(
    supabase,
    original.almacen_destino_id,
    lineasConControl,
    "Puede que ya se haya vendido o movido parte de lo que entró de más por el traslado original.",
  );
  if (errorStock) {
    redirect(`/traslados?error=${encodeURIComponent(errorStock)}`);
  }

  const nota = `Reversión del traslado del ${formatFechaHora(original.fecha)} — la mercadería nunca se movió físicamente.`;

  const { data: reversion, error: reversionError } = await supabase
    .from("traslados")
    .insert({
      empresa_id: empresaId,
      almacen_origen_id: original.almacen_destino_id,
      almacen_destino_id: original.almacen_origen_id,
      usuario_id: userId,
      nota,
    })
    .select("id")
    .single();

  if (reversionError || !reversion) {
    redirect(
      `/traslados?error=${encodeURIComponent(reversionError?.message ?? "No se pudo registrar la reversión.")}`,
    );
  }

  const { data: detalleRows, error: detalleError } = await supabase
    .from("traslado_detalle")
    .insert(
      lineasOriginales.map((l) => ({
        traslado_id: reversion.id,
        producto_id: l.producto_id,
        cantidad: l.cantidad,
      })),
    )
    .select("id, producto_id, cantidad");

  if (detalleError || !detalleRows) {
    redirect(
      `/traslados?error=${encodeURIComponent(detalleError?.message ?? "No se pudo registrar el detalle de la reversión.")}`,
    );
  }

  const movimientos: Parameters<typeof registrarMovimientosKardex>[3] = [];
  for (const row of detalleRows) {
    const llevaInventario = productosInfo?.find(
      (p) => p.id === row.producto_id,
    )?.control_inventario;
    if (!llevaInventario) continue;

    movimientos.push({
      productoId: row.producto_id,
      almacenId: original.almacen_destino_id,
      tipoMovimiento: "traslado_salida",
      cantidad: -row.cantidad,
      referenciaId: row.id,
      detalle: nota,
    });
    movimientos.push({
      productoId: row.producto_id,
      almacenId: original.almacen_origen_id,
      tipoMovimiento: "traslado_entrada",
      cantidad: row.cantidad,
      referenciaId: row.id,
      detalle: nota,
    });
  }

  const admin = createAdminClient();
  await registrarMovimientosKardex(admin, empresaId, userId, movimientos);

  revalidatePath("/traslados");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  redirect("/traslados");
}

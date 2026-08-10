"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { getEmpresaSession } from "@/utils/supabase/session";
import { registrarMovimientosKardex, validarStockDisponible } from "@/utils/supabase/kardex";

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
    .filter((l) => l.producto_id && l.cantidad > 0);

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

  const productoIdsUnicos = new Set(lineas.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineas.length) {
    redirect(
      `/traslados/nuevo?error=${encodeURIComponent("Hay un producto repetido. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  // Solo el administrador puede mover mercadería entre almacenes libremente
  // (cualquier origen, cualquier destino). Cualquier otro rol —vendedor,
  // logística— solo puede ENVIAR desde su propio almacén hacia otro, nunca
  // recibir ni mover entre dos almacenes que no sean el suyo.
  if (rol !== "admin" && almacenId !== almacenOrigenId) {
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

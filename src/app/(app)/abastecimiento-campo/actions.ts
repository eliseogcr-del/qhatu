"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession, resolverAlmacenId } from "@/utils/supabase/session";
import { registrarMovimientosKardex } from "@/utils/supabase/kardex";

// Registro de mercadería que un vendedor recoge de un proveedor mientras
// está en ruta, sin precio ni documento de compra — solo qué y cuánto.
// Siempre suma al almacén del propio vendedor, así que a diferencia de
// traslados no hace falta el cliente admin: la escritura de kardex/
// inventario cae dentro de lo que su propia sesión ya puede tocar.
export async function createAbastecimientoCampo(formData: FormData) {
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);
  const { userId, empresaId } = session;

  const almacenId = resolverAlmacenId(session, formData);
  if (!almacenId) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent("Selecciona el almacén al que va esta mercadería.")}`,
    );
  }

  const proveedorId = String(formData.get("proveedor_id") ?? "").trim() || null;
  const nota = String(formData.get("nota") ?? "").trim() || null;

  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);

  const lineas = productoIds
    .map((producto_id, i) => ({ producto_id, cantidad: cantidades[i] }))
    .filter((l) => l.producto_id);

  if (lineas.length === 0) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent("Agrega al menos un producto.")}`,
    );
  }
  if (lineas.some((l) => !(l.cantidad > 0))) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent("Cada producto debe tener una cantidad mayor a 0.")}`,
    );
  }

  const productoIdsUnicos = new Set(lineas.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineas.length) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent("Hay un producto repetido. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  const { data: abastecimiento, error: abastecimientoError } = await supabase
    .from("abastecimientos_campo")
    .insert({
      empresa_id: empresaId,
      almacen_id: almacenId,
      proveedor_id: proveedorId,
      usuario_id: userId,
      nota,
    })
    .select("id")
    .single();

  if (abastecimientoError || !abastecimiento) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent(abastecimientoError?.message ?? "No se pudo registrar el abastecimiento.")}`,
    );
  }

  const { data: detalleRows, error: detalleError } = await supabase
    .from("abastecimiento_campo_detalle")
    .insert(
      lineas.map((l) => ({
        abastecimiento_id: abastecimiento.id,
        producto_id: l.producto_id,
        cantidad: l.cantidad,
      })),
    )
    .select("id, producto_id, cantidad");

  if (detalleError || !detalleRows) {
    redirect(
      `/abastecimiento-campo/nuevo?error=${encodeURIComponent(detalleError?.message ?? "No se pudo registrar el detalle.")}`,
    );
  }

  const { data: productosInfo } = await supabase
    .from("productos")
    .select("id, control_inventario")
    .in("id", [...productoIdsUnicos]);

  const movimientos: Parameters<typeof registrarMovimientosKardex>[3] = [];
  for (const row of detalleRows) {
    const llevaInventario = productosInfo?.find(
      (p) => p.id === row.producto_id,
    )?.control_inventario;
    if (!llevaInventario) continue;

    movimientos.push({
      productoId: row.producto_id,
      almacenId,
      tipoMovimiento: "abastecimiento_campo",
      cantidad: row.cantidad,
      referenciaId: row.id,
      detalle: nota,
    });
  }

  await registrarMovimientosKardex(supabase, empresaId, userId, movimientos);

  // Registro automático e interno de la compra al proveedor: el ingreso
  // del producto ya lo hizo este abastecimiento (kardex incluido), así
  // que esta compra "espejo" nunca vuelve a tocar kardex/inventario —
  // solo deja constancia del costo para cuentas por pagar, pendiente de
  // que Admin/Logística la valide. Nunca bloquea el abastecimiento: si
  // algo sale mal generándola, el abastecimiento ya quedó registrado.
  if (proveedorId) {
    try {
      const { data: productosCosto } = await supabase
        .from("productos")
        .select("id, costo_referencial, unidades_medida(cantidad)")
        .in("id", [...productoIdsUnicos]);

      const lineasCompra = detalleRows.map((row) => {
        const info = productosCosto?.find((p) => p.id === row.producto_id);
        const factor =
          (info?.unidades_medida as unknown as { cantidad: number } | null)
            ?.cantidad || 1;
        const costoUnitario =
          Math.round(((info?.costo_referencial ?? 0) / factor) * 100) / 100;
        return {
          producto_id: row.producto_id,
          cantidad: row.cantidad,
          costo_unitario: costoUnitario,
          subtotal: Math.round(costoUnitario * row.cantidad * 100) / 100,
        };
      });

      const { data: compraAuto, error: compraAutoError } = await supabase
        .from("compras")
        .insert({
          empresa_id: empresaId,
          proveedor_id: proveedorId,
          total: lineasCompra.reduce((acc, l) => acc + l.subtotal, 0),
          usuario_id: userId,
          almacen_id: almacenId,
          origen: "abastecimiento_campo",
          validado: false,
          abastecimiento_id: abastecimiento.id,
        })
        .select("id")
        .single();

      if (!compraAutoError && compraAuto) {
        await supabase.from("compra_detalle").insert(
          lineasCompra.map((l) => ({
            compra_id: compraAuto.id,
            producto_id: l.producto_id,
            cantidad: l.cantidad,
            costo_unitario: l.costo_unitario,
            subtotal: l.subtotal,
          })),
        );
      }
    } catch {
      // best-effort: ver comentario arriba.
    }
  }

  revalidatePath("/abastecimiento-campo");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  revalidatePath("/compras");
  redirect("/abastecimiento-campo");
}

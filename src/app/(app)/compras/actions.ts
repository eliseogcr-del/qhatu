"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession, resolverAlmacenId } from "@/utils/supabase/session";
import { registrarMovimientosKardex } from "@/utils/supabase/kardex";
import { getSaldoCompra } from "@/utils/supabase/compras";

// Compras es de un solo paso: registrarla asume que la mercadería ya se
// recibió, así que sube el stock de inmediato (a diferencia de
// pedido→venta, que separa lo pedido de lo entregado).
export async function createCompra(formData: FormData) {
  const supabase = await createClient();
  const session = await getEmpresaSession(supabase);
  const { userId, empresaId } = session;

  const almacenId = resolverAlmacenId(session, formData);
  if (!almacenId) {
    redirect(
      `/compras/nueva?error=${encodeURIComponent("Selecciona el almacén/local para esta compra.")}`,
    );
  }

  const proveedorId = String(formData.get("proveedor_id") ?? "");
  const moneda = String(formData.get("moneda") ?? "PEN");
  const tipoCambio = Number(formData.get("tipo_cambio_aplicado") ?? 1);

  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);
  const costos = formData.getAll("costo_unitario[]").map(Number);

  const lineas = productoIds
    .map((producto_id, i) => ({
      producto_id,
      cantidad: cantidades[i],
      costo_unitario: costos[i],
      subtotal: Math.round(cantidades[i] * costos[i] * 100) / 100,
    }))
    .filter((l) => l.producto_id && l.cantidad > 0);

  if (!proveedorId || lineas.length === 0) {
    redirect(
      `/compras/nueva?error=${encodeURIComponent("Selecciona un proveedor y agrega al menos un producto.")}`,
    );
  }

  const productoIdsUnicos = new Set(lineas.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineas.length) {
    redirect(
      `/compras/nueva?error=${encodeURIComponent("Hay un producto repetido en la compra. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  const total = lineas.reduce((acc, l) => acc + l.subtotal, 0);

  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .insert({
      empresa_id: empresaId,
      proveedor_id: proveedorId,
      moneda,
      tipo_cambio_aplicado: tipoCambio,
      total,
      usuario_id: userId,
      almacen_id: almacenId,
    })
    .select("id")
    .single();

  if (compraError || !compra) {
    redirect(
      `/compras/nueva?error=${encodeURIComponent(compraError?.message ?? "No se pudo registrar la compra.")}`,
    );
  }

  const [{ data: compraDetalleRows }, { data: productosInfo }] =
    await Promise.all([
      supabase
        .from("compra_detalle")
        .insert(
          lineas.map((l) => ({
            compra_id: compra.id,
            producto_id: l.producto_id,
            cantidad: l.cantidad,
            costo_unitario: l.costo_unitario,
            subtotal: l.subtotal,
          })),
        )
        .select("id"),
      supabase
        .from("productos")
        .select("id, control_inventario")
        .in("id", [...productoIdsUnicos]),
    ]);

  const movimientosKardex: Parameters<typeof registrarMovimientosKardex>[3] = [];
  lineas.forEach((linea, i) => {
    const compraDetalleId = compraDetalleRows?.[i]?.id;
    const llevaInventario = productosInfo?.find(
      (p) => p.id === linea.producto_id,
    )?.control_inventario;

    if (llevaInventario) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId,
        tipoMovimiento: "compra",
        cantidad: linea.cantidad,
        referenciaId: compraDetalleId ?? null,
      });
    }
  });

  const [, ...costoResultados] = await Promise.all([
    registrarMovimientosKardex(supabase, empresaId, userId, movimientosKardex),
    ...lineas.map((l) =>
      supabase
        .from("productos")
        .update({ costo_referencial: l.costo_unitario })
        .eq("id", l.producto_id),
    ),
  ]);

  const costoError = costoResultados.find((r) => r.error)?.error ?? null;

  revalidatePath("/compras");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  revalidatePath("/productos");

  if (costoError) {
    redirect(
      `/compras/${compra.id}?error=${encodeURIComponent(
        `La compra se registró, pero no se pudo actualizar el costo de referencia: ${costoError.message}`,
      )}`,
    );
  }

  redirect(`/compras/${compra.id}`);
}

// Anular una compra exige que no queden pagos activos, igual que ventas:
// si ya se le pagó algo al proveedor, primero hay que anular ese pago.
export async function anularCompra(compraId: string) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const { data: compra } = await supabase
    .from("compras")
    .select("id, estado, almacen_id")
    .eq("id", compraId)
    .single();

  if (!compra) redirect("/compras");

  if (compra.estado === "anulada") {
    redirect(`/compras/${compraId}`);
  }

  const { data: pagosActivos } = await supabase
    .from("pagos_proveedor")
    .select("id")
    .eq("compra_id", compraId)
    .eq("estado", "activa");

  if (pagosActivos && pagosActivos.length > 0) {
    redirect(
      `/compras/${compraId}?error=${encodeURIComponent(
        "Esta compra tiene pagos activos. Anula primero el/los pago(s) antes de anular la compra.",
      )}`,
    );
  }

  const { data: detalle } = await supabase
    .from("compra_detalle")
    .select("id, producto_id, cantidad, productos(control_inventario)")
    .eq("compra_id", compraId);

  const movimientosKardex: Parameters<typeof registrarMovimientosKardex>[3] = [];
  for (const linea of detalle ?? []) {
    const llevaInventario = (
      linea.productos as unknown as { control_inventario: boolean } | null
    )?.control_inventario;

    if (llevaInventario) {
      movimientosKardex.push({
        productoId: linea.producto_id,
        almacenId: compra.almacen_id,
        tipoMovimiento: "ajuste",
        cantidad: -linea.cantidad,
        referenciaId: linea.id,
      });
    }
  }
  await registrarMovimientosKardex(supabase, empresaId, userId, movimientosKardex);

  await supabase.from("compras").update({ estado: "anulada" }).eq("id", compraId);

  revalidatePath(`/compras/${compraId}`);
  revalidatePath("/compras");
  revalidatePath("/inventario");
  revalidatePath("/kardex");
  redirect(`/compras/${compraId}`);
}

export async function createPagoProveedor(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const compraId = String(formData.get("compra_id") ?? "");
  const monto = Number(formData.get("monto") ?? 0);
  const moneda = String(formData.get("moneda") ?? "PEN");
  const tipoCambio = Number(formData.get("tipo_cambio_aplicado") ?? 1);
  const metodoPago = String(formData.get("metodo_pago") ?? "efectivo");
  const referencia = String(formData.get("referencia") ?? "") || null;

  if (!compraId || monto <= 0) {
    redirect(
      `/compras/${compraId}?error=${encodeURIComponent("Ingresa un monto válido.")}`,
    );
  }

  const { data: compra } = await supabase
    .from("compras")
    .select("id, total, estado")
    .eq("id", compraId)
    .single();

  if (!compra) redirect("/compras");

  if (compra.estado === "anulada") {
    redirect(
      `/compras/${compraId}?error=${encodeURIComponent("Esta compra está anulada, no se le pueden registrar pagos.")}`,
    );
  }

  const saldoPendiente = await getSaldoCompra(supabase, compraId, compra.total);
  if (monto > saldoPendiente) {
    redirect(
      `/compras/${compraId}?error=${encodeURIComponent(
        `El monto (${monto.toFixed(2)}) no puede ser mayor al saldo pendiente (${saldoPendiente.toFixed(2)}).`,
      )}`,
    );
  }

  const { error } = await supabase.from("pagos_proveedor").insert({
    empresa_id: empresaId,
    compra_id: compraId,
    monto,
    moneda,
    tipo_cambio_aplicado: tipoCambio,
    metodo_pago: metodoPago,
    referencia,
    usuario_id: userId,
  });

  if (error) {
    redirect(`/compras/${compraId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/compras/${compraId}`);
  revalidatePath("/compras");
  redirect(`/compras/${compraId}`);
}

// Un pago a proveedor nunca se borra — anularlo lo excluye del saldo
// pagado pero conserva el registro, igual que anularCobranza.
export async function anularPagoProveedor(pagoId: string, compraId: string) {
  const supabase = await createClient();
  await getEmpresaSession(supabase);

  const { data: pago } = await supabase
    .from("pagos_proveedor")
    .select("id, estado")
    .eq("id", pagoId)
    .single();

  if (!pago || pago.estado === "anulada") {
    redirect(`/compras/${compraId}`);
  }

  await supabase.from("pagos_proveedor").update({ estado: "anulada" }).eq("id", pagoId);

  revalidatePath(`/compras/${compraId}`);
  revalidatePath("/compras");
  redirect(`/compras/${compraId}`);
}

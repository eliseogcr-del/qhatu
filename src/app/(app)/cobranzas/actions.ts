"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { registrarAuditoria, TIPO_AUDITORIA } from "@/utils/supabase/auditoria";
import { UMBRAL_BLOQUEO_BYTES, buildNombreArchivoCobranza } from "@/lib/cobranza-adjuntos";

export async function createCobranza(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const pedidoId = String(formData.get("pedido_id") ?? "");
  const monto = Number(formData.get("monto") ?? 0);
  const moneda = String(formData.get("moneda") ?? "PEN");
  const tipoCambio = Number(formData.get("tipo_cambio_aplicado") || 1);
  const metodoPago = String(formData.get("metodo_pago") ?? "efectivo");
  const referencia = String(formData.get("referencia") ?? "") || null;

  if (!pedidoId || monto <= 0) {
    redirect(
      `/cobranzas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent("Ingresa un monto válido.")}`,
    );
  }
  if (!(tipoCambio > 0)) {
    redirect(
      `/cobranzas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent("El tipo de cambio debe ser mayor a 0.")}`,
    );
  }

  const { data: pedido } = await supabase
    .from("pedidos")
    .select("id, total, clientes(nombre)")
    .eq("id", pedidoId)
    .single();

  if (!pedido) {
    redirect(`/cobranzas/nueva?error=${encodeURIComponent("El pedido no existe.")}`);
  }

  const { data: venta } = await supabase
    .from("ventas")
    .select("id, total, descuento")
    .eq("pedido_id", pedidoId)
    .maybeSingle();

  const { data: cobranzasPrevias } = await supabase
    .from("cobranzas")
    .select("monto")
    .eq(venta ? "venta_id" : "pedido_id", venta ? venta.id : pedidoId)
    .eq("estado", "activa");

  const totalReferencia = venta ? venta.total - venta.descuento : pedido.total;
  const cobradoPrevio = (cobranzasPrevias ?? []).reduce((acc, c) => acc + c.monto, 0);
  const saldoPendiente = Math.round((totalReferencia - cobradoPrevio) * 100) / 100;

  if (monto > saldoPendiente) {
    redirect(
      `/cobranzas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent(
        `El monto (${monto.toFixed(2)}) no puede ser mayor al saldo pendiente (${saldoPendiente.toFixed(2)}).`,
      )}`,
    );
  }

  const { data: cobranza, error } = await supabase
    .from("cobranzas")
    .insert({
      empresa_id: empresaId,
      pedido_id: pedidoId,
      venta_id: venta?.id ?? null,
      monto,
      moneda,
      tipo_cambio_aplicado: tipoCambio,
      metodo_pago: metodoPago,
      tipo_pago: venta ? "pago" : "anticipo",
      referencia,
      usuario_id: userId,
    })
    .select("id")
    .single();

  if (error || !cobranza) {
    redirect(
      `/cobranzas/nueva?pedido_id=${pedidoId}&error=${encodeURIComponent(error?.message ?? "No se pudo registrar el cobro.")}`,
    );
  }

  // Evidencia de pago (foto). Se sube solo si aún hay espacio disponible
  // en el plan free — nunca bloquea el registro del cobro en sí.
  const { data: bytesUsados } = await supabase.rpc("total_storage_usado_bytes");
  const archivos = formData
    .getAll("evidencias")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (archivos.length > 0 && (bytesUsados ?? 0) < UMBRAL_BLOQUEO_BYTES) {
    const clienteNombre =
      (pedido.clientes as unknown as { nombre: string } | null)?.nombre ?? "Cliente";
    const codigoCobranza = cobranza.id.slice(0, 8).toUpperCase();
    const fecha = new Date().toISOString().slice(0, 10);

    let correlativo = 0;
    for (const archivo of archivos) {
      correlativo += 1;
      const extension = archivo.name.split(".").pop() ?? "jpg";
      const nombreArchivo = buildNombreArchivoCobranza({
        codigoCobranza,
        clienteNombre,
        fecha,
        correlativo,
        extension,
      });
      const path = `${empresaId}/${cobranza.id}/${nombreArchivo}`;

      const { error: uploadError } = await supabase.storage
        .from("cobranza-adjuntos")
        .upload(path, archivo);

      if (!uploadError) {
        await supabase.from("cobranza_adjuntos").insert({
          empresa_id: empresaId,
          cobranza_id: cobranza.id,
          nombre_archivo: nombreArchivo,
          storage_path: path,
          tamano_bytes: archivo.size,
        });
      }
    }
  }

  revalidatePath("/cobranzas");
  revalidatePath("/evidencias-pago");
  revalidatePath(`/pedidos/${pedidoId}`);
  redirect(`/pedidos/${pedidoId}`);
}

// Sube o reemplaza la evidencia de pago de un cobro ya registrado. A
// diferencia de crear el cobro (que acepta varias fotos), acá se trata
// como una sola evidencia vigente por cobro: si ya había una, se borra
// (archivo + fila) antes de subir la nueva, en vez de acumular.
export async function actualizarEvidenciaCobranza(
  cobranzaId: string,
  ventaId: string,
  clienteNombre: string,
  formData: FormData,
) {
  const supabase = await createClient();
  const { empresaId } = await getEmpresaSession(supabase);

  const archivo = formData.get("evidencia");
  if (!(archivo instanceof File) || archivo.size === 0) {
    redirect(`/ventas/${ventaId}?error=${encodeURIComponent("Selecciona una imagen para subir.")}`);
  }

  const { data: cobranza } = await supabase
    .from("cobranzas")
    .select("id, fecha")
    .eq("id", cobranzaId)
    .single();

  if (!cobranza) redirect(`/ventas/${ventaId}`);

  const { data: anteriores } = await supabase
    .from("cobranza_adjuntos")
    .select("id, storage_path")
    .eq("cobranza_id", cobranzaId);

  if (anteriores && anteriores.length > 0) {
    const paths = anteriores
      .map((a) => a.storage_path)
      .filter((p): p is string => !!p);
    if (paths.length > 0) {
      await supabase.storage.from("cobranza-adjuntos").remove(paths);
    }
    await supabase.from("cobranza_adjuntos").delete().eq("cobranza_id", cobranzaId);
  }

  const { data: bytesUsados } = await supabase.rpc("total_storage_usado_bytes");
  if ((bytesUsados ?? 0) >= UMBRAL_BLOQUEO_BYTES) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent("Se alcanzó el límite de almacenamiento de imágenes. Un administrador debe liberar espacio antes de poder subir otra.")}`,
    );
  }

  const codigoCobranza = cobranzaId.slice(0, 8).toUpperCase();
  const fecha = cobranza.fecha.slice(0, 10);
  const extension = archivo.name.split(".").pop() ?? "jpg";
  const nombreArchivo = buildNombreArchivoCobranza({
    codigoCobranza,
    clienteNombre,
    fecha,
    correlativo: 1,
    extension,
  });
  const path = `${empresaId}/${cobranzaId}/${nombreArchivo}`;

  const { error: uploadError } = await supabase.storage
    .from("cobranza-adjuntos")
    .upload(path, archivo);

  if (uploadError) {
    redirect(
      `/ventas/${ventaId}?error=${encodeURIComponent(`No se pudo subir la imagen: ${uploadError.message}`)}`,
    );
  }

  await supabase.from("cobranza_adjuntos").insert({
    empresa_id: empresaId,
    cobranza_id: cobranzaId,
    nombre_archivo: nombreArchivo,
    storage_path: path,
    tamano_bytes: archivo.size,
  });

  revalidatePath(`/ventas/${ventaId}`);
  revalidatePath("/evidencias-pago");
}

// Un cobro nunca se borra — anularlo lo excluye del saldo cobrado pero
// conserva el registro, y queda auditado quién lo anuló y cuándo.
export async function anularCobranza(cobranzaId: string, redirectTo: string) {
  const supabase = await createClient();
  const { userId, empresaId } = await getEmpresaSession(supabase);

  const { data: cobranza } = await supabase
    .from("cobranzas")
    .select("id, monto, moneda, metodo_pago, referencia, estado, venta_id, pedido_id")
    .eq("id", cobranzaId)
    .single();

  if (!cobranza || cobranza.estado === "anulada") {
    redirect(redirectTo);
  }

  await supabase.from("cobranzas").update({ estado: "anulada" }).eq("id", cobranzaId);

  await registrarAuditoria(supabase, {
    empresaId,
    usuarioId: userId,
    entidad: "cobranza",
    entidadId: cobranzaId,
    tipoMovimiento: TIPO_AUDITORIA.cobranzaAnular,
    monto: cobranza.monto,
    detalle: `Cobro anulado (${cobranza.moneda} ${cobranza.monto}, ${cobranza.metodo_pago}${
      cobranza.referencia ? `, ref: ${cobranza.referencia}` : ""
    }).`,
  });

  revalidatePath("/cobranzas");
  if (cobranza.venta_id) revalidatePath(`/ventas/${cobranza.venta_id}`);
  if (cobranza.pedido_id) revalidatePath(`/pedidos/${cobranza.pedido_id}`);
  redirect(redirectTo);
}

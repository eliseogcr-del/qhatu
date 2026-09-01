"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireComercial, resolverAlmacenId } from "@/utils/supabase/session";
import { preciosBloqueados, resolverPrecios } from "@/utils/supabase/precios";

export async function createCotizacion(formData: FormData) {
  const supabase = await createClient();
  const { userId, empresaId } = await requireComercial(supabase);

  const clienteId = String(formData.get("cliente_id") ?? "") || null;
  const prospectoNombre = String(formData.get("prospecto_nombre") ?? "").trim() || null;
  const prospectoRuc = String(formData.get("prospecto_ruc") ?? "").trim() || null;
  const prospectoTelefono = String(formData.get("prospecto_telefono") ?? "").trim() || null;
  const prospectoCorreo = String(formData.get("prospecto_correo") ?? "").trim() || null;
  const moneda = String(formData.get("moneda") ?? "PEN");
  const ofertaValidaHasta = String(formData.get("oferta_valida_hasta") ?? "") || null;
  const fechaEntrega = String(formData.get("fecha_entrega") ?? "") || null;
  const lugarEntrega = String(formData.get("lugar_entrega") ?? "").trim() || null;

  if (!clienteId && !prospectoNombre) {
    redirect(
      `/cotizaciones/nuevo?error=${encodeURIComponent("Selecciona un cliente registrado o ingresa el nombre del prospecto.")}`,
    );
  }

  const productoIds = formData.getAll("producto_id[]").map(String);
  const cantidades = formData.getAll("cantidad[]").map(Number);
  const precios = formData.getAll("precio_unitario[]").map(Number);
  const unidadesMedidaIds = formData.getAll("unidad_medida_id[]").map(String);

  const lineasConProducto = productoIds
    .map((producto_id, i) => ({
      producto_id,
      cantidad: cantidades[i],
      precio_unitario: precios[i],
      unidad_medida_id: unidadesMedidaIds[i] || null,
    }))
    .filter((l) => l.producto_id);

  if (lineasConProducto.length === 0) {
    redirect(
      `/cotizaciones/nuevo?error=${encodeURIComponent("Agrega al menos un producto a la cotización.")}`,
    );
  }

  if (lineasConProducto.some((l) => !(l.cantidad > 0) || !(l.precio_unitario > 0))) {
    redirect(
      `/cotizaciones/nuevo?error=${encodeURIComponent("Cada producto debe tener una cantidad y un precio unitario mayores a 0.")}`,
    );
  }

  const productoIdsUnicos = new Set(lineasConProducto.map((l) => l.producto_id));
  if (productoIdsUnicos.size !== lineasConProducto.length) {
    redirect(
      `/cotizaciones/nuevo?error=${encodeURIComponent("Hay un producto repetido en la cotización. Cada producto debe aparecer una sola vez.")}`,
    );
  }

  // Una cotización no tiene almacén propio, así que siempre se trata como
  // canal campo (esDigital = false) salvo que el cliente tenga un precio
  // especial configurado.
  let lineasConPrecio = lineasConProducto;
  if (await preciosBloqueados(supabase, empresaId)) {
    const precios = await resolverPrecios(supabase, {
      empresaId,
      clienteId,
      esDigital: false,
      lineas: lineasConProducto.map((l) => ({
        productoId: l.producto_id,
        unidadMedidaId: l.unidad_medida_id,
      })),
    });
    lineasConPrecio = lineasConProducto.map((l) => ({
      ...l,
      precio_unitario: precios.get(l.producto_id) ?? l.precio_unitario,
    }));
  }

  const { data: config } = await supabase
    .from("configuracion_cotizaciones")
    .select("numero_inicial, porcentaje_igv")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  const numeroInicial = config?.numero_inicial ?? 1;
  const porcentajeIgv = config?.porcentaje_igv ?? 10.5;

  // El precio unitario ya incluye el impuesto (igual que en Nota de
  // venta/Boleta) — el impuesto se extrae del total de cada línea, no se
  // suma encima de un precio sin impuesto.
  const lineas = lineasConPrecio.map((l) => {
    const lineaTotal = Math.round(l.cantidad * l.precio_unitario * 100) / 100;
    const valorUnitario = l.precio_unitario / (1 + porcentajeIgv / 100);
    const subtotalSinIgv = Math.round(l.cantidad * valorUnitario * 100) / 100;
    return {
      ...l,
      subtotal: lineaTotal,
      subtotalSinIgv,
      igvLinea: Math.round((lineaTotal - subtotalSinIgv) * 100) / 100,
    };
  });

  const subtotal = Math.round(lineas.reduce((acc, l) => acc + l.subtotalSinIgv, 0) * 100) / 100;
  const igv = Math.round(lineas.reduce((acc, l) => acc + l.igvLinea, 0) * 100) / 100;
  const total = Math.round(lineas.reduce((acc, l) => acc + l.subtotal, 0) * 100) / 100;

  const { data: ultima } = await supabase
    .from("cotizaciones")
    .select("numero")
    .eq("empresa_id", empresaId)
    .order("numero", { ascending: false })
    .limit(1)
    .maybeSingle();

  const numero = Math.max((ultima?.numero ?? 0) + 1, numeroInicial);

  const { data: cotizacion, error: cotizacionError } = await supabase
    .from("cotizaciones")
    .insert({
      empresa_id: empresaId,
      numero,
      usuario_id: userId,
      cliente_id: clienteId,
      prospecto_nombre: clienteId ? null : prospectoNombre,
      prospecto_ruc: clienteId ? null : prospectoRuc,
      prospecto_telefono: clienteId ? null : prospectoTelefono,
      prospecto_correo: clienteId ? null : prospectoCorreo,
      moneda,
      oferta_valida_hasta: ofertaValidaHasta,
      fecha_entrega: fechaEntrega,
      lugar_entrega: lugarEntrega,
      porcentaje_igv: porcentajeIgv,
      subtotal,
      igv,
      total,
    })
    .select("id")
    .single();

  if (cotizacionError || !cotizacion) {
    redirect(
      `/cotizaciones/nuevo?error=${encodeURIComponent(cotizacionError?.message ?? "No se pudo crear la cotización.")}`,
    );
  }

  const { error: detalleError } = await supabase.from("cotizacion_detalle").insert(
    lineas.map((l) => ({
      producto_id: l.producto_id,
      cantidad: l.cantidad,
      precio_unitario: l.precio_unitario,
      unidad_medida_id: l.unidad_medida_id,
      subtotal: l.subtotal,
      cotizacion_id: cotizacion.id,
    })),
  );

  if (detalleError) {
    redirect(`/cotizaciones/nuevo?error=${encodeURIComponent(detalleError.message)}`);
  }

  revalidatePath("/cotizaciones");
  redirect(`/cotizaciones/${cotizacion.id}`);
}

// Convierte una cotización en un Pedido real. Si el cliente era un
// prospecto sin registrar, primero lo registra como Cliente (usando el RUC
// como documento) — solo se puede convertir si el prospecto trae un
// RUC/DNI, ya que clientes.numero_documento es obligatorio; si no lo trae,
// se pide registrar el cliente manualmente antes de convertir.
export async function enviarAPedido(cotizacionId: string, formData: FormData) {
  const supabase = await createClient();
  const session = await requireComercial(supabase);
  const { userId, empresaId } = session;

  const almacenId = resolverAlmacenId(session, formData);
  if (!almacenId) {
    redirect(
      `/cotizaciones/${cotizacionId}/enviar-a-pedido?error=${encodeURIComponent("Selecciona el almacén/local para este pedido.")}`,
    );
  }

  const { data: cotizacion } = await supabase
    .from("cotizaciones")
    .select(
      "id, cliente_id, prospecto_nombre, prospecto_ruc, prospecto_telefono, prospecto_correo, moneda, total, pedido_id",
    )
    .eq("id", cotizacionId)
    .single();

  if (!cotizacion) redirect("/cotizaciones");

  if (cotizacion.pedido_id) {
    redirect(`/cotizaciones/${cotizacionId}`);
  }

  let clienteId = cotizacion.cliente_id;

  if (!clienteId) {
    if (!cotizacion.prospecto_ruc) {
      redirect(
        `/cotizaciones/${cotizacionId}?error=${encodeURIComponent("Este prospecto no tiene RUC/DNI — registra el cliente manualmente antes de convertir la cotización en pedido.")}`,
      );
    }

    const { data: clienteExistente } = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("numero_documento", cotizacion.prospecto_ruc)
      .maybeSingle();

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const { data: nuevoCliente, error: clienteError } = await supabase
        .from("clientes")
        .insert({
          empresa_id: empresaId,
          tipo_documento: cotizacion.prospecto_ruc!.length === 11 ? "RUC" : "DNI",
          numero_documento: cotizacion.prospecto_ruc,
          nombre: cotizacion.prospecto_nombre ?? "Cliente",
          telefono: cotizacion.prospecto_telefono,
          correo_electronico: cotizacion.prospecto_correo,
        })
        .select("id")
        .single();

      if (clienteError || !nuevoCliente) {
        redirect(
          `/cotizaciones/${cotizacionId}?error=${encodeURIComponent(clienteError?.message ?? "No se pudo registrar el cliente del prospecto.")}`,
        );
      }
      clienteId = nuevoCliente!.id;
    }
  }

  const { data: detalle } = await supabase
    .from("cotizacion_detalle")
    .select("producto_id, cantidad, precio_unitario, subtotal, unidad_medida_id")
    .eq("cotizacion_id", cotizacionId);

  if (!detalle || detalle.length === 0) {
    redirect(
      `/cotizaciones/${cotizacionId}?error=${encodeURIComponent("Esta cotización no tiene productos.")}`,
    );
  }

  // El pedido no tiene concepto de impuesto (a diferencia de la
  // cotización, que suma su 10.5% configurable) — su total es, como en
  // cualquier otro pedido del sistema, la suma de los subtotales de línea.
  const totalPedido =
    Math.round(detalle!.reduce((acc, d) => acc + d.subtotal, 0) * 100) / 100;

  const { data: pedido, error: pedidoError } = await supabase
    .from("pedidos")
    .insert({
      empresa_id: empresaId,
      cliente_id: clienteId,
      canal_pedido: "cotizacion",
      moneda: cotizacion.moneda,
      total: totalPedido,
      usuario_id: userId,
      almacen_id: almacenId,
    })
    .select("id")
    .single();

  if (pedidoError || !pedido) {
    redirect(
      `/cotizaciones/${cotizacionId}?error=${encodeURIComponent(pedidoError?.message ?? "No se pudo crear el pedido.")}`,
    );
  }

  const { error: detalleError } = await supabase.from("pedido_detalle").insert(
    detalle!.map((d) => ({
      pedido_id: pedido!.id,
      producto_id: d.producto_id,
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      subtotal: d.subtotal,
      unidad_medida_id: d.unidad_medida_id,
    })),
  );

  if (detalleError) {
    redirect(`/cotizaciones/${cotizacionId}?error=${encodeURIComponent(detalleError.message)}`);
  }

  await supabase.from("cotizaciones").update({ pedido_id: pedido!.id }).eq("id", cotizacionId);

  revalidatePath("/cotizaciones");
  revalidatePath("/pedidos");
  revalidatePath(`/cotizaciones/${cotizacionId}`);
  redirect(`/pedidos/${pedido!.id}`);
}

import { createClient } from "./server";
import type { NubefactGuiaItem, NubefactGuiaRemitenteRequest } from "../nubefact";

// Catálogo 06 de SUNAT, acotado a lo que la ficha de cliente permite
// elegir (DNI/RUC/CE) — a diferencia de tipoDocumentoNubefact (factura/
// boleta, que acepta "-" para "sin documento"), acá no hay valor válido
// para eso: la guía exige uno de estos tres.
function tipoDocumentoGuia(tipoDocumentoCliente: string): number | null {
  switch (tipoDocumentoCliente) {
    case "RUC":
      return 6;
    case "DNI":
      return 1;
    case "CE":
      return 4;
    default:
      return null;
  }
}

// "YYYY-MM-DD" (como lo guarda Postgres) -> "DD-MM-YYYY" (como lo pide Nubefact).
function formatearFechaGuia(fechaIso: string): string {
  const [anio, mes, dia] = fechaIso.split("-");
  return `${dia}-${mes}-${anio}`;
}

function fechaDeHoyGuia(): string {
  const hoy = new Date();
  return `${String(hoy.getDate()).padStart(2, "0")}-${String(hoy.getMonth() + 1).padStart(
    2,
    "0",
  )}-${hoy.getFullYear()}`;
}

type DatosGuiaRemitente = Omit<
  NubefactGuiaRemitenteRequest,
  "operacion" | "tipo_de_comprobante" | "serie" | "numero"
>;

// Arma todo el cuerpo de la Guía de Remisión Remitente a partir de un
// reparto ya guardado — el llamador (generarGuiaRemision) solo le agrega
// serie/numero, que dependen de configuracion_facturacion y de cuántas
// guías van emitidas, algo ajeno a este armado. Grimana Food solo emite
// GRE Remitente (nunca Transportista, ver comentario en la migración de
// guias_remision), así que el tipo de comprobante siempre es 7.
export async function construirDatosGuiaRemitente(
  supabase: Awaited<ReturnType<typeof createClient>>,
  repartoId: string,
): Promise<{ datos: DatosGuiaRemitente } | { error: string }> {
  const { data: reparto } = await supabase
    .from("repartos")
    .select(
      `id, tipo_transporte, transportista_nombre, transportista_ruc, placa_numero,
       peso_bruto_total, numero_de_bultos, repartidor_id, fecha_reparto, pedido_id,
       pedidos (
         cliente_id, almacen_id, fecha,
         clientes ( tipo_documento, numero_documento, nombre, direccion, ubigeo ),
         almacenes ( direccion, ubigeo )
       )`,
    )
    .eq("id", repartoId)
    .single();

  if (!reparto) return { error: "No se encontró el reparto." };

  const pedido = reparto.pedidos as unknown as {
    cliente_id: string;
    almacen_id: string;
    fecha: string;
    clientes: {
      tipo_documento: string;
      numero_documento: string;
      nombre: string;
      direccion: string | null;
      ubigeo: string | null;
    } | null;
    almacenes: { direccion: string | null; ubigeo: string | null } | null;
  } | null;

  if (!pedido) return { error: "El reparto no tiene un pedido asociado." };

  const cliente = pedido.clientes;
  const almacen = pedido.almacenes;

  if (!cliente) return { error: "El pedido no tiene cliente asociado." };
  if (!almacen) return { error: "El pedido no tiene almacén asociado." };

  if (!almacen.ubigeo) {
    return {
      error:
        "Falta el ubigeo del almacén de origen. Complétalo en Administración → Almacenes.",
    };
  }
  if (!almacen.direccion) {
    return {
      error: "Falta la dirección del almacén de origen. Complétala en Administración → Almacenes.",
    };
  }
  if (!cliente.ubigeo) {
    return {
      error: "Falta el ubigeo del cliente de destino. Complétalo en la ficha del cliente.",
    };
  }
  if (!cliente.direccion) {
    return { error: "Falta la dirección del cliente de destino. Complétala en Clientes." };
  }
  if (!reparto.placa_numero) {
    return { error: "Falta la placa del vehículo en este reparto." };
  }
  if (!reparto.peso_bruto_total || reparto.peso_bruto_total <= 0) {
    return { error: "Falta el peso bruto total del reparto." };
  }
  if (!reparto.numero_de_bultos || reparto.numero_de_bultos <= 0) {
    return { error: "Falta el número de bultos del reparto." };
  }

  const tipoDocDestinatario = tipoDocumentoGuia(cliente.tipo_documento);
  if (tipoDocDestinatario === null) {
    return {
      error:
        "El cliente debe tener DNI, RUC o Carné de extranjería para la guía de remisión.",
    };
  }

  const fechaTraslado = formatearFechaGuia(reparto.fecha_reparto ?? pedido.fecha);
  const esPrivado = reparto.tipo_transporte !== "delivery_subcontratado";

  let datosTransporte: Partial<NubefactGuiaRemitenteRequest>;

  if (esPrivado) {
    if (!reparto.repartidor_id) {
      return { error: "Selecciona el repartidor/conductor de este reparto." };
    }
    const { data: conductor } = await supabase
      .from("usuarios")
      .select("nombre, apellidos, dni, licencia_conducir")
      .eq("id", reparto.repartidor_id)
      .single();

    if (!conductor?.dni || !conductor.apellidos || !conductor.licencia_conducir) {
      return {
        error:
          "Faltan datos del conductor (DNI, apellidos o licencia). Complétalos en Usuarios.",
      };
    }

    datosTransporte = {
      conductor_documento_tipo: "1",
      conductor_documento_numero: conductor.dni,
      conductor_nombre: conductor.nombre ?? "",
      conductor_apellidos: conductor.apellidos,
      conductor_numero_licencia: conductor.licencia_conducir,
    };
  } else {
    if (!reparto.transportista_nombre || !reparto.transportista_ruc) {
      return { error: "Faltan los datos del transportista (nombre y RUC) en este reparto." };
    }
    datosTransporte = {
      transportista_documento_tipo: "6",
      transportista_documento_numero: reparto.transportista_ruc,
      transportista_denominacion: reparto.transportista_nombre,
      fecha_de_entrega_al_transportista: fechaTraslado,
    };
  }

  const { data: detalle } = await supabase
    .from("pedido_detalle")
    .select("cantidad, productos(nombre)")
    .eq("pedido_id", reparto.pedido_id);

  if (!detalle || detalle.length === 0) {
    return { error: "El pedido no tiene productos." };
  }

  const items: NubefactGuiaItem[] = detalle.map((d) => ({
    unidad_de_medida: "NIU",
    descripcion: (d.productos as unknown as { nombre: string } | null)?.nombre ?? "Producto",
    cantidad: String(d.cantidad),
  }));

  const datos: DatosGuiaRemitente = {
    cliente_tipo_de_documento: tipoDocDestinatario,
    cliente_numero_de_documento: cliente.numero_documento,
    cliente_denominacion: cliente.nombre,
    cliente_direccion: cliente.direccion,
    fecha_de_emision: fechaDeHoyGuia(),
    motivo_de_traslado: "01", // Venta — la única razón por la que se traslada mercadería acá
    peso_bruto_total: String(reparto.peso_bruto_total),
    peso_bruto_unidad_de_medida: "KGM",
    numero_de_bultos: String(reparto.numero_de_bultos),
    tipo_de_transporte: esPrivado ? "02" : "01",
    fecha_de_inicio_de_traslado: fechaTraslado,
    transportista_placa_numero: reparto.placa_numero,
    punto_de_partida_ubigeo: almacen.ubigeo,
    punto_de_partida_direccion: almacen.direccion,
    punto_de_llegada_ubigeo: cliente.ubigeo,
    punto_de_llegada_direccion: cliente.direccion,
    enviar_automaticamente_al_cliente: "false",
    items,
    ...datosTransporte,
  };

  return { datos };
}

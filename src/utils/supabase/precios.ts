import { createClient } from "./server";

// El precio de un producto para un cliente/almacén dado sigue siempre el
// mismo orden: 1) precio especial pactado con ese cliente para ese
// producto (si existe), 2) Precio Digital si el almacén es el canal
// digital, 3) Precio Campo en cualquier otro caso (principal, móvil,
// secundario, etc.). Cotizaciones no tienen almacén propio — usan el
// almacén fijo del vendedor que las crea (null para admin, que cae a
// esDigital = false).
//
// Precio Campo/Digital son por la unidad de medida por defecto del
// producto, y el precio especial es por la unidad que se negoció con ese
// cliente — si la línea del pedido/venta usa una unidad distinta, hay que
// convertir proporcionalmente (ej. si el especial es "S/30 por DOCENA" y
// la línea pide en UNIDAD, el precio por unidad es 30/12).
export async function resolverPrecios(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    empresaId: string;
    clienteId: string | null;
    esDigital: boolean;
    lineas: { productoId: string; unidadMedidaId: string | null }[];
  },
): Promise<Map<string, number>> {
  const { empresaId, clienteId, esDigital, lineas } = params;
  const productoIds = [...new Set(lineas.map((l) => l.productoId))];
  if (productoIds.length === 0) return new Map();

  const [{ data: productos }, { data: especiales }] = await Promise.all([
    supabase
      .from("productos")
      .select("id, precio_campo, precio_digital, unidad_medida_id")
      .in("id", productoIds),
    clienteId
      ? supabase
          .from("precios_especiales_cliente")
          .select("producto_id, precio, unidad_medida_id")
          .eq("empresa_id", empresaId)
          .eq("cliente_id", clienteId)
          .in("producto_id", productoIds)
      : Promise.resolve({
          data: [] as { producto_id: string; precio: number; unidad_medida_id: string }[],
        }),
  ]);

  const productoPorId = new Map((productos ?? []).map((p) => [p.id, p]));
  const especialPorProducto = new Map((especiales ?? []).map((e) => [e.producto_id, e]));

  const unidadIdsInvolucradas = [
    ...new Set(
      [
        ...lineas.map((l) => l.unidadMedidaId),
        ...(productos ?? []).map((p) => p.unidad_medida_id),
        ...(especiales ?? []).map((e) => e.unidad_medida_id),
      ].filter((v): v is string => Boolean(v)),
    ),
  ];
  const { data: unidadesInfo } =
    unidadIdsInvolucradas.length > 0
      ? await supabase.from("unidades_medida").select("id, cantidad").in("id", unidadIdsInvolucradas)
      : { data: [] as { id: string; cantidad: number }[] };
  const factorPorUnidad = new Map((unidadesInfo ?? []).map((u) => [u.id, u.cantidad as number]));
  const factorDe = (unidadMedidaId: string | null | undefined) =>
    unidadMedidaId ? (factorPorUnidad.get(unidadMedidaId) ?? 1) : 1;

  const resultado = new Map<string, number>();
  for (const linea of lineas) {
    const factorLinea = factorDe(linea.unidadMedidaId);
    const especial = especialPorProducto.get(linea.productoId);

    if (especial) {
      const precio = (especial.precio * factorLinea) / factorDe(especial.unidad_medida_id);
      resultado.set(linea.productoId, Math.round(precio * 100) / 100);
      continue;
    }

    const producto = productoPorId.get(linea.productoId);
    if (!producto) continue;
    const precioLista = esDigital ? producto.precio_digital : producto.precio_campo;
    const precio = (precioLista * factorLinea) / factorDe(producto.unidad_medida_id);
    resultado.set(linea.productoId, Math.round(precio * 100) / 100);
  }
  return resultado;
}

export async function esAlmacenDigital(
  supabase: Awaited<ReturnType<typeof createClient>>,
  almacenId: string | null,
): Promise<boolean> {
  if (!almacenId) return false;
  const { data } = await supabase
    .from("almacenes")
    .select("es_digital")
    .eq("id", almacenId)
    .maybeSingle();
  return data?.es_digital ?? false;
}

// Bloqueado por defecto (aunque la empresa nunca haya guardado la fila de
// configuración) — es la opción segura: nadie puede sobreescribir a mano
// un precio calculado hasta que un admin lo desbloquee explícitamente.
export async function preciosBloqueados(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("configuracion_precios")
    .select("precios_bloqueados")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  return data?.precios_bloqueados ?? true;
}

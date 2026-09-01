import { createClient } from "./server";

// El precio de un producto para un cliente/almacén dado sigue siempre el
// mismo orden: 1) precio especial pactado con ese cliente para ese
// producto (si existe), 2) Precio Digital si el almacén es el canal
// digital, 3) Precio Campo en cualquier otro caso (principal, móvil,
// secundario, etc.). Cotizaciones no tienen almacén propio — se tratan
// siempre como canal campo (esDigital = false).
export async function resolverPrecios(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    empresaId: string;
    clienteId: string | null;
    esDigital: boolean;
    productoIds: string[];
  },
): Promise<Map<string, number>> {
  const { empresaId, clienteId, esDigital, productoIds } = params;
  const idsUnicos = [...new Set(productoIds)];
  if (idsUnicos.length === 0) return new Map();

  const [{ data: productos }, { data: especiales }] = await Promise.all([
    supabase
      .from("productos")
      .select("id, precio_campo, precio_digital")
      .in("id", idsUnicos),
    clienteId
      ? supabase
          .from("precios_especiales_cliente")
          .select("producto_id, precio")
          .eq("empresa_id", empresaId)
          .eq("cliente_id", clienteId)
          .in("producto_id", idsUnicos)
      : Promise.resolve({ data: [] as { producto_id: string; precio: number }[] }),
  ]);

  const precioEspecialPorProducto = new Map(
    (especiales ?? []).map((e) => [e.producto_id, e.precio]),
  );

  const resultado = new Map<string, number>();
  for (const producto of productos ?? []) {
    const especial = precioEspecialPorProducto.get(producto.id);
    const precioLista = esDigital ? producto.precio_digital : producto.precio_campo;
    resultado.set(producto.id, especial ?? precioLista);
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

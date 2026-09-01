"use server";

import { createClient } from "@/utils/supabase/server";
import { getEmpresaSession } from "@/utils/supabase/session";
import { resolverPrecios, esAlmacenDigital } from "@/utils/supabase/precios";

// Se llama directamente desde los formularios de pedido/venta
// directa/cotización (cliente) cada vez que cambia el cliente, el
// producto, la unidad de medida o el almacén de una línea, para mostrar
// el precio calculado sin que el usuario pueda escribirlo a mano. La
// autoridad real sigue siendo el servidor al guardar (acá solo se usa
// para pintar el precio en pantalla mientras se arma el formulario).
export async function consultarPrecioLinea(
  clienteId: string | null,
  productoId: string,
  unidadMedidaId: string | null,
  almacenId: string | null,
): Promise<number> {
  const supabase = await createClient();
  const { empresaId } = await getEmpresaSession(supabase);

  const digital = await esAlmacenDigital(supabase, almacenId);
  const precios = await resolverPrecios(supabase, {
    empresaId,
    clienteId,
    esDigital: digital,
    lineas: [{ productoId, unidadMedidaId }],
  });

  return precios.get(productoId) ?? 0;
}

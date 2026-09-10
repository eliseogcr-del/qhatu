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

// Se llama al elegir el cliente en Venta directa (y donde más haga falta)
// para avisar si tiene deudas de ventas anteriores — solo informativo, no
// bloquea continuar con la venta nueva. Solo las ventas (no los pedidos
// sueltos) generan deuda real, mismo criterio que Cobranzas.
export async function consultarSaldoCliente(clienteId: string): Promise<{
  saldo: number;
  moneda: string;
  fechaUltimaVenta: string;
} | null> {
  if (!clienteId) return null;

  const supabase = await createClient();

  const { data: ventas } = await supabase
    .from("ventas")
    .select("id, fecha, moneda, total, descuento")
    .eq("cliente_id", clienteId)
    .neq("estado", "anulada")
    .order("fecha", { ascending: false });

  if (!ventas || ventas.length === 0) return null;

  const ventaIds = ventas.map((v) => v.id);
  const { data: cobranzas } = await supabase
    .from("cobranzas")
    .select("venta_id, monto")
    .eq("estado", "activa")
    .in("venta_id", ventaIds);

  const cobradoPorVenta = new Map<string, number>();
  for (const c of cobranzas ?? []) {
    if (!c.venta_id) continue;
    cobradoPorVenta.set(c.venta_id, (cobradoPorVenta.get(c.venta_id) ?? 0) + c.monto);
  }

  let saldoTotal = 0;
  let fechaUltimaVenta: string | null = null;
  let moneda = "PEN";
  for (const v of ventas) {
    const cobrado = cobradoPorVenta.get(v.id) ?? 0;
    const saldo = Math.round((v.total - v.descuento - cobrado) * 100) / 100;
    if (saldo > 0.009) {
      saldoTotal += saldo;
      moneda = v.moneda;
      if (!fechaUltimaVenta || v.fecha > fechaUltimaVenta) fechaUltimaVenta = v.fecha;
    }
  }

  if (saldoTotal <= 0.009 || !fechaUltimaVenta) return null;

  return { saldo: Math.round(saldoTotal * 100) / 100, moneda, fechaUltimaVenta };
}

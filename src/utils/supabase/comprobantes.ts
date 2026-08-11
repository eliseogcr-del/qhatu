import { createClient } from "./server";
import type { NubefactItem } from "../nubefact";

const PORCENTAJE_IGV = 0.18;

// Compartido entre la emisión de comprobantes Nubefact (factura/boleta/NC)
// y la nota de venta interna — ambos parten de las mismas líneas
// entregadas de la venta.
export async function construirItemsYTotales(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ventaId: string,
) {
  const { data: detalle } = await supabase
    .from("venta_detalle")
    .select("cantidad_entregada, precio_unitario, subtotal, productos(nombre)")
    .eq("venta_id", ventaId)
    .gt("cantidad_entregada", 0);

  if (!detalle || detalle.length === 0) return null;

  const items: NubefactItem[] = detalle.map((d) => {
    const valorUnitario = Math.round((d.precio_unitario / (1 + PORCENTAJE_IGV)) * 100) / 100;
    const subtotalSinIgv = Math.round(valorUnitario * d.cantidad_entregada * 100) / 100;
    const igvLinea = Math.round((d.subtotal - subtotalSinIgv) * 100) / 100;
    return {
      unidad_de_medida: "NIU",
      descripcion: (d.productos as unknown as { nombre: string } | null)?.nombre ?? "Producto",
      cantidad: d.cantidad_entregada,
      valor_unitario: valorUnitario,
      precio_unitario: d.precio_unitario,
      subtotal: subtotalSinIgv,
      tipo_de_igv: 1,
      igv: igvLinea,
      total: d.subtotal,
      anticipo_regularizacion: false,
    };
  });

  const totalGravada = Math.round(items.reduce((acc, i) => acc + i.subtotal, 0) * 100) / 100;
  const totalIgv = Math.round(items.reduce((acc, i) => acc + i.igv, 0) * 100) / 100;
  const total = Math.round((totalGravada + totalIgv) * 100) / 100;

  return { items, totalGravada, totalIgv, total };
}

export function fechaDeHoy() {
  const hoy = new Date();
  return `${String(hoy.getDate()).padStart(2, "0")}-${String(hoy.getMonth() + 1).padStart(
    2,
    "0",
  )}-${hoy.getFullYear()}`;
}

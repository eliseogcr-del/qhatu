import { createClient } from "@/utils/supabase/server";
import {
  obtenerPorcentajeIgv,
  itemsDesdeLineas,
  totalesConFormulaAnterior,
} from "@/utils/supabase/comprobantes";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import { chunk } from "@/lib/chunk";

export type FilaAuditoriaIgv = {
  id: string;
  fecha: string;
  documento: string;
  clienteNombre: string;
  total: number;
  gravadaDeclarada: number;
  igvDeclarado: number;
  gravadaCorrecta: number;
  igvCorrecto: number;
  diferenciaIgv: number;
};

// Compartido entre la pantalla y el export a Excel — recalcula, para cada
// factura/boleta/nota de crédito ya emitida, el IGV declarado con la
// fórmula vieja (con el bug de redondeo, hasta el 15/10/2026) contra el
// que correspondía con la fórmula correcta, ambos desde las mismas
// líneas originales que siguen guardadas en venta_detalle /
// comprobante_libre_detalle.
export async function obtenerFilasAuditoriaIgv(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
): Promise<{ filas: FilaAuditoriaIgv[]; totalRevisados: number }> {
  const porcentajeIgv = await obtenerPorcentajeIgv(supabase, empresaId);

  const { data: comprobantes } = await supabase
    .from("comprobantes")
    .select(
      "id, tipo_comprobante, serie, numero, fecha_emision, origen, venta_id, cliente_id, ventas(descuento, clientes(nombre)), clientes(nombre)",
    )
    .eq("estado", "emitido")
    .in("tipo_comprobante", [1, 2, 3])
    .order("fecha_emision", { ascending: true });

  const comprobantesVenta = (comprobantes ?? []).filter((c) => c.origen === "venta" && c.venta_id);
  const comprobantesLibres = (comprobantes ?? []).filter((c) => c.origen === "libre");

  const ventaIds = [...new Set(comprobantesVenta.map((c) => c.venta_id as string))];
  const detalleVentas = (
    await Promise.all(
      chunk(ventaIds, 150).map((ids) =>
        supabase
          .from("venta_detalle")
          .select("venta_id, cantidad_entregada, precio_unitario, subtotal")
          .in("venta_id", ids)
          .gt("cantidad_entregada", 0),
      ),
    )
  ).flatMap((r) => r.data ?? []);

  const detallePorVenta = new Map<string, typeof detalleVentas>();
  for (const d of detalleVentas) {
    const lista = detallePorVenta.get(d.venta_id) ?? [];
    lista.push(d);
    detallePorVenta.set(d.venta_id, lista);
  }

  const libreIds = comprobantesLibres.map((c) => c.id);
  const detalleLibres = (
    await Promise.all(
      chunk(libreIds, 150).map((ids) =>
        supabase
          .from("comprobante_libre_detalle")
          .select("comprobante_id, cantidad, precio_unitario, subtotal")
          .in("comprobante_id", ids),
      ),
    )
  ).flatMap((r) => r.data ?? []);

  const detallePorLibre = new Map<string, typeof detalleLibres>();
  for (const d of detalleLibres) {
    const lista = detallePorLibre.get(d.comprobante_id) ?? [];
    lista.push(d);
    detallePorLibre.set(d.comprobante_id, lista);
  }

  const filas = (comprobantes ?? [])
    .map((c) => {
      let lineas: { cantidad: number; precio_unitario: number; subtotal: number }[] = [];
      let clienteNombre = "—";

      if (c.origen === "venta" && c.venta_id) {
        const venta = c.ventas as unknown as { descuento: number; clientes: { nombre: string } | null } | null;
        clienteNombre = venta?.clientes?.nombre ?? "—";
        lineas = (detallePorVenta.get(c.venta_id) ?? []).map((d) => ({
          cantidad: d.cantidad_entregada,
          precio_unitario: d.precio_unitario,
          subtotal: d.subtotal,
        }));
        if (venta && venta.descuento > 0) {
          lineas.push({ cantidad: 1, precio_unitario: -venta.descuento, subtotal: -venta.descuento });
        }
      } else {
        clienteNombre = (c.clientes as unknown as { nombre: string } | null)?.nombre ?? "—";
        lineas = (detallePorLibre.get(c.id) ?? []).map((d) => ({
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.subtotal,
        }));
      }

      if (lineas.length === 0) return null;

      const anterior = totalesConFormulaAnterior(lineas, porcentajeIgv);
      const correcta = itemsDesdeLineas(
        lineas.map((l) => ({ ...l, descripcion: "" })),
        porcentajeIgv,
      );

      const diferenciaIgv = Math.round((correcta.totalIgv - anterior.totalIgv) * 100) / 100;

      return {
        id: c.id,
        fecha: c.fecha_emision,
        documento: `${TIPO_COMPROBANTE_LABEL[c.tipo_comprobante]} ${c.serie}-${c.numero}`,
        clienteNombre,
        total: correcta.total,
        gravadaDeclarada: anterior.totalGravada,
        igvDeclarado: anterior.totalIgv,
        gravadaCorrecta: correcta.totalGravada,
        igvCorrecto: correcta.totalIgv,
        diferenciaIgv,
      };
    })
    .filter((f): f is FilaAuditoriaIgv => f !== null && Math.abs(f.diferenciaIgv) > 0.004);

  return { filas, totalRevisados: comprobantes?.length ?? 0 };
}

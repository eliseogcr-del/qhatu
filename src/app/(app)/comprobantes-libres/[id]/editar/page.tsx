import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import { formatFechaSolo, hoyLima } from "@/lib/fecha";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import ComprobanteLibreForm from "@/components/ComprobanteLibreForm";
import { editarComprobanteLibre } from "../../actions";

export default async function EditarComprobanteLibrePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  await requireComprobantesAcceso(supabase);

  const { data: comprobante } = await supabase
    .from("comprobantes")
    .select(
      "id, tipo_comprobante, serie, numero, estado, error_mensaje, tipo_emision, comprobante_anticipo_id, descripcion, cliente_id",
    )
    .eq("id", id)
    .eq("origen", "libre")
    .maybeSingle();

  if (!comprobante) notFound();

  if (comprobante.estado !== "pendiente" && comprobante.estado !== "error") {
    return (
      <div className="p-8">
        <div className="mx-auto max-w-2xl">
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            Este comprobante ya fue {comprobante.estado === "emitido" ? "emitido" : "anulado"} — no se
            puede editar.
          </p>
          <Link
            href="/comprobantes-libres"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: clientes }, { data: productos }, { data: anticiposRaw }, { data: lineas }] =
    await Promise.all([
      supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
      supabase
        .from("comprobantes")
        .select("id, tipo_comprobante, serie, numero, fecha_emision, clientes(nombre)")
        .eq("origen", "libre")
        .eq("tipo_emision", "anticipo")
        .eq("estado", "emitido")
        .neq("id", id)
        .order("fecha_emision", { ascending: false }),
      supabase
        .from("comprobante_libre_detalle")
        .select("producto_id, descripcion, cantidad, precio_unitario")
        .eq("comprobante_id", id),
    ]);

  const anticipoIds = (anticiposRaw ?? []).map((a) => a.id);
  const { data: detalleAnticipos } =
    anticipoIds.length > 0
      ? await supabase
          .from("comprobante_libre_detalle")
          .select("comprobante_id, subtotal")
          .in("comprobante_id", anticipoIds)
      : { data: [] as { comprobante_id: string; subtotal: number }[] };

  const totalPorAnticipo = new Map<string, number>();
  for (const d of detalleAnticipos ?? []) {
    totalPorAnticipo.set(d.comprobante_id, (totalPorAnticipo.get(d.comprobante_id) ?? 0) + d.subtotal);
  }

  const anticipos = (anticiposRaw ?? []).map((a) => {
    const clienteNombre = (a.clientes as unknown as { nombre: string } | null)?.nombre ?? "—";
    const total = Math.round((totalPorAnticipo.get(a.id) ?? 0) * 100) / 100;
    return {
      id: a.id,
      etiqueta: `${TIPO_COMPROBANTE_LABEL[a.tipo_comprobante]} ${a.serie}-${a.numero} — ${clienteNombre} (${formatFechaSolo(a.fecha_emision.slice(0, 10))}) — S/ ${total.toFixed(2)}`,
    };
  });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Editar comprobante libre</h1>
          <Link
            href="/comprobantes-libres"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <p className="mb-6 text-sm text-gray-500">
          Este comprobante nunca llegó a emitirse en SUNAT ({comprobante.estado === "error" ? "quedó en error" : "quedó pendiente"}) —
          corrige lo que haga falta y reintenta con el mismo número ya reservado.
        </p>

        {comprobante.error_mensaje && (
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Último error: {comprobante.error_mensaje}
          </p>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <ComprobanteLibreForm
            action={editarComprobanteLibre.bind(null, id)}
            error={error}
            clientes={clientes ?? []}
            productos={productos ?? []}
            anticipos={anticipos}
            hoy={hoyLima()}
            documentoFijo={`${TIPO_COMPROBANTE_LABEL[comprobante.tipo_comprobante]} ${comprobante.serie}-${comprobante.numero}`}
            submitLabel="Guardar y reintentar"
            submitPendingLabel="Reintentando..."
            valoresIniciales={{
              clienteId: comprobante.cliente_id ?? "",
              fechaEmision: hoyLima(),
              tipoEmision: (comprobante.tipo_emision as "" | "anticipo" | "saldo" | null) ?? "",
              comprobanteAnticipoId: comprobante.comprobante_anticipo_id ?? "",
              descripcion: comprobante.descripcion ?? "",
              lineas: (lineas ?? []).map((l) => ({
                productoId: l.producto_id ?? "",
                descripcion: l.descripcion,
                cantidad: l.cantidad,
                precioUnitario: l.precio_unitario,
              })),
            }}
          />
        </div>
      </div>
    </div>
  );
}

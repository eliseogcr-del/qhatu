import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import { formatFechaSolo, hoyLima } from "@/lib/fecha";
import { TIPO_COMPROBANTE_LABEL } from "@/lib/comprobante-links";
import ComprobanteLibreForm from "@/components/ComprobanteLibreForm";
import { emitirComprobanteLibre } from "../actions";

export default async function NuevoComprobanteLibrePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  await requireComprobantesAcceso(supabase);

  const [{ data: clientes }, { data: productos }, { data: anticiposRaw }] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
    supabase
      .from("comprobantes")
      .select("id, tipo_comprobante, serie, numero, fecha_emision, clientes(nombre)")
      .eq("origen", "libre")
      .eq("tipo_emision", "anticipo")
      .eq("estado", "emitido")
      .order("fecha_emision", { ascending: false }),
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
          <h1 className="text-2xl font-semibold text-gray-900">Nuevo comprobante libre</h1>
          <Link
            href="/comprobantes-libres"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <p className="mb-6 text-sm text-gray-500">
          Comprobante independiente de una venta — para anticipos (y su regularización por
          saldo). No afecta inventario ni kardex. Una vez exista la venta real, se puede asociar
          desde ahí por tipo y número.
        </p>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <ComprobanteLibreForm
            action={emitirComprobanteLibre}
            error={error}
            clientes={clientes ?? []}
            productos={productos ?? []}
            anticipos={anticipos}
            hoy={hoyLima()}
          />
        </div>
      </div>
    </div>
  );
}

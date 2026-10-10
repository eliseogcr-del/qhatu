import Link from "next/link";
import { Plus, FileText, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import { formatFechaHora } from "@/lib/fecha";
import { chunk } from "@/lib/chunk";
import { TIPO_COMPROBANTE_LABEL, enlacePdfComprobante } from "@/lib/comprobante-links";

const TIPO_EMISION_LABEL: Record<string, string> = {
  anticipo: "Anticipo",
  saldo: "Saldo",
};

export default async function ComprobantesLibresPage({
  searchParams,
}: {
  searchParams: Promise<{ emitido?: string }>;
}) {
  const { emitido } = await searchParams;
  const supabase = await createClient();
  await requireComprobantesAcceso(supabase);

  const { data: comprobantes } = await supabase
    .from("comprobantes")
    .select(
      "id, tipo_comprobante, serie, numero, estado, tipo_emision, fecha_emision, venta_id, enlace_pdf, clientes(nombre)",
    )
    .eq("origen", "libre")
    .order("fecha_emision", { ascending: false });

  const ids = (comprobantes ?? []).map((c) => c.id);
  const detalle = (
    await Promise.all(
      chunk(ids, 150).map((idsChunk) =>
        supabase.from("comprobante_libre_detalle").select("comprobante_id, subtotal").in("comprobante_id", idsChunk),
      ),
    )
  ).flatMap((r) => r.data ?? []);

  const totalPorComprobante = new Map<string, number>();
  for (const d of detalle) {
    totalPorComprobante.set(d.comprobante_id, (totalPorComprobante.get(d.comprobante_id) ?? 0) + d.subtotal);
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Comprobantes libres</h1>
          <Link
            href="/comprobantes-libres/nuevo"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={16} />
            Nuevo comprobante
          </Link>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          Facturas y boletas independientes de una venta (anticipos y su regularización por
          saldo). No afectan inventario ni kardex.
        </p>

        {emitido === "1" && (
          <p className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            <CheckCircle2 size={16} />
            Comprobante emitido correctamente.
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Documento</th>
                <th className="px-4 py-3 font-bold">Emisión</th>
                <th className="px-4 py-3 text-right font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3 font-bold">Venta asociada</th>
                <th className="px-4 py-3 font-bold">PDF</th>
              </tr>
            </thead>
            <tbody>
              {(comprobantes ?? []).map((c) => {
                const cliente = c.clientes as unknown as { nombre: string } | null;
                const total = Math.round((totalPorComprobante.get(c.id) ?? 0) * 100) / 100;
                const pdf = enlacePdfComprobante(c);
                return (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 text-gray-600">{formatFechaHora(c.fecha_emision)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{cliente?.nombre ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {TIPO_COMPROBANTE_LABEL[c.tipo_comprobante]} {c.serie}-{c.numero}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.tipo_emision ? TIPO_EMISION_LABEL[c.tipo_emision] : "Normal"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{total.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {c.estado === "emitido" ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Emitido
                        </span>
                      ) : c.estado === "error" ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Error
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {c.estado}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.venta_id ? (
                        <Link
                          href={`/ventas/${c.venta_id}`}
                          className="font-medium text-emerald-700 hover:underline"
                        >
                          Ver venta
                        </Link>
                      ) : (
                        <span className="text-gray-400">Sin asociar</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {pdf && (
                        <a
                          href={pdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-emerald-700 hover:underline"
                        >
                          <FileText size={14} />
                          PDF
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(comprobantes ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Aún no hay comprobantes libres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

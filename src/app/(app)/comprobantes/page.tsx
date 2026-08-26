import Link from "next/link";
import { formatFecha, inicioDiaLima, finDiaLima } from "@/lib/fecha";
import { FileText } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { TIPO_COMPROBANTE_LABEL, enlacePdfComprobante } from "@/lib/comprobante-links";
import ComprobantesFiltroForm from "@/components/ComprobantesFiltroForm";
import ResultadosCount from "@/components/ResultadosCount";

const ESTADO_BADGE: Record<string, string> = {
  emitido: "bg-green-100 text-green-700",
  pendiente: "bg-yellow-100 text-yellow-700",
  error: "bg-red-100 text-red-700",
  anulado: "bg-gray-100 text-gray-600",
};

export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; desde?: string; hasta?: string; estado?: string }>;
}) {
  const { q, desde, hasta, estado } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("comprobantes")
    .select(
      q
        ? "id, tipo_comprobante, serie, numero, estado, aceptado_por_sunat, enlace_pdf, enlace_xml, fecha_emision, venta_id, almacenes(nombre), ventas!inner(total, moneda, clientes!inner(nombre))"
        : "id, tipo_comprobante, serie, numero, estado, aceptado_por_sunat, enlace_pdf, enlace_xml, fecha_emision, venta_id, almacenes(nombre), ventas(total, moneda, clientes(nombre))",
    )
    .order("fecha_emision", { ascending: false });

  if (q) query = query.ilike("ventas.clientes.nombre", `%${q}%`);
  if (desde) query = query.gte("fecha_emision", inicioDiaLima(desde));
  if (hasta) query = query.lte("fecha_emision", finDiaLima(hasta));
  if (estado) query = query.eq("estado", estado);

  const { data: comprobantes, error } = await query;

  const hayFiltros = !!(q || desde || hasta || estado);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <FileText size={24} className="text-emerald-700" />
          <h1 className="text-2xl font-semibold text-gray-900">Comprobantes electrónicos</h1>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Facturas y boletas emitidas a través de Nubefact, y notas de venta
          (documento interno, sin XML ni valor fiscal).
        </p>

        <ComprobantesFiltroForm
          q={q ?? ""}
          desde={desde ?? ""}
          hasta={hasta ?? ""}
          estado={estado ?? ""}
          hayFiltros={hayFiltros}
        />

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <ResultadosCount count={comprobantes?.length ?? 0} />

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Comprobante</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 font-bold">Almacén</th>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Total</th>
                <th className="px-4 py-3 font-bold">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {comprobantes?.map((c) => {
                const venta = c.ventas as unknown as {
                  total: number;
                  moneda: string;
                  clientes: { nombre: string } | null;
                } | null;
                const almacen = c.almacenes as unknown as { nombre: string } | null;
                const enlacePdf = enlacePdfComprobante(c);
                return (
                  <tr key={c.id} className="border-b-2 border-gray-200 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {TIPO_COMPROBANTE_LABEL[c.tipo_comprobante] ?? "Comprobante"} {c.serie}-
                      {c.numero}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {venta?.clientes?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {almacen?.nombre ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatFecha(c.fecha_emision)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {venta ? `${venta.moneda} ${venta.total.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${ESTADO_BADGE[c.estado] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {c.estado}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {enlacePdf && (
                          <a
                            href={enlacePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-emerald-700 hover:underline"
                          >
                            Ver PDF
                          </a>
                        )}
                        {c.enlace_xml && (
                          <a
                            href={c.enlace_xml}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-emerald-700 hover:underline"
                          >
                            XML
                          </a>
                        )}
                        <Link
                          href={`/ventas/${c.venta_id}`}
                          className="text-sm font-medium text-gray-700 hover:underline"
                        >
                          Ver venta
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {comprobantes?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                    {hayFiltros
                      ? "Ningún comprobante coincide con los filtros."
                      : "Aún no hay comprobantes emitidos."}
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

import Link from "next/link";
import { formatFecha } from "@/lib/fecha";
import { FileText, Search, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { TIPO_COMPROBANTE_LABEL } from "@/utils/nubefact";

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
        ? "id, tipo_comprobante, serie, numero, estado, aceptado_por_sunat, enlace_pdf, enlace_xml, fecha_emision, venta_id, ventas!inner(total, moneda, clientes!inner(nombre))"
        : "id, tipo_comprobante, serie, numero, estado, aceptado_por_sunat, enlace_pdf, enlace_xml, fecha_emision, venta_id, ventas(total, moneda, clientes(nombre))",
    )
    .order("fecha_emision", { ascending: false });

  if (q) query = query.ilike("ventas.clientes.nombre", `%${q}%`);
  if (desde) query = query.gte("fecha_emision", desde);
  if (hasta) query = query.lte("fecha_emision", `${hasta}T23:59:59`);
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
          Facturas y boletas emitidas a través de Nubefact.
        </p>

        <form
          className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
          method="get"
        >
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Cliente</label>
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                name="q"
                defaultValue={q ?? ""}
                placeholder="Buscar por nombre..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
            <input
              type="date"
              name="desde"
              defaultValue={desde ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta ?? ""}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Estado</label>
            <select name="estado" defaultValue={estado ?? ""} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Todos</option>
              <option value="emitido">Emitido</option>
              <option value="pendiente">Pendiente</option>
              <option value="error">Error</option>
              <option value="anulado">Anulado</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
          {hayFiltros && (
            <Link
              href="/comprobantes"
              className="flex items-center gap-1 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Limpiar
            </Link>
          )}
        </form>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Comprobante</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
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
                return (
                  <tr key={c.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {TIPO_COMPROBANTE_LABEL[c.tipo_comprobante] ?? "Comprobante"} {c.serie}-
                      {c.numero}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {venta?.clientes?.nombre ?? "—"}
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
                        {c.enlace_pdf && (
                          <a
                            href={c.enlace_pdf}
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
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
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

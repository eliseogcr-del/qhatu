import Link from "next/link";
import { FileDown, Calculator } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireComprobantesAcceso } from "@/utils/supabase/session";
import { formatFecha } from "@/lib/fecha";
import ExportLinkButton from "@/components/ExportLinkButton";
import { obtenerFilasAuditoriaIgv } from "./shared";

// Reporte de auditoría — NO es una pantalla operativa, es solo para
// cuantificar el impacto del bug de redondeo de IGV que tuvo
// itemsDesdeLineas hasta el 15/10/2026 (ver commit "Corrige el
// redondeo de IGV por línea en todos los comprobantes"). Recalcula,
// para cada factura/boleta/nota de crédito ya emitida, cuánto se
// declaró con la fórmula vieja (con el bug) vs cuánto correspondía con
// la fórmula correcta — ambas a partir de las mismas líneas originales
// que siguen guardadas (venta_detalle / comprobante_libre_detalle), así
// que la comparación es exacta, no una estimación.
export default async function AuditoriaIgvPage() {
  const supabase = await createClient();
  const { empresaId } = await requireComprobantesAcceso(supabase);

  const { filas, totalRevisados } = await obtenerFilasAuditoriaIgv(supabase, empresaId);

  const sumaDiferencia = Math.round(filas.reduce((acc, f) => acc + f.diferenciaIgv, 0) * 100) / 100;
  const sumaDeclarado = Math.round(filas.reduce((acc, f) => acc + f.igvDeclarado, 0) * 100) / 100;
  const sumaCorrecto = Math.round(filas.reduce((acc, f) => acc + f.igvCorrecto, 0) * 100) / 100;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calculator size={24} className="text-emerald-700" />
            <h1 className="text-2xl font-semibold text-gray-900">Auditoría IGV</h1>
          </div>
          <ExportLinkButton href="/auditoria-igv/export" icon={<FileDown size={16} />}>
            Exportar a Excel
          </ExportLinkButton>
        </div>

        <p className="mb-6 text-sm text-gray-500">
          Compara, para cada factura/boleta/nota de crédito ya emitida, el IGV declarado con la
          fórmula que tenía un bug de redondeo (hasta el 15/10/2026) contra el IGV que correspondía
          con la fórmula correcta — ambos recalculados desde las mismas líneas originales que
          siguen guardadas. Solo se listan los comprobantes con una diferencia real (más de medio
          céntimo); el total cobrado al cliente en cada uno nunca cambió, solo cómo se repartía
          internamente entre Valor de Venta e IGV.
        </p>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              IGV declarado (fórmula vieja)
            </p>
            <p className="mt-1 text-xl font-semibold text-gray-900">S/ {sumaDeclarado.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              IGV correcto (fórmula nueva)
            </p>
            <p className="mt-1 text-xl font-semibold text-gray-900">S/ {sumaCorrecto.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Diferencia total (correcto − declarado)
            </p>
            <p className="mt-1 text-xl font-semibold text-emerald-900">
              {sumaDiferencia >= 0 ? "+" : ""}
              S/ {sumaDiferencia.toFixed(2)}
            </p>
          </div>
        </div>

        <p className="mb-4 text-sm text-gray-500">
          {filas.length} comprobante{filas.length === 1 ? "" : "s"} con diferencia, de{" "}
          {totalRevisados} revisados.
        </p>

        <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-bold">Fecha</th>
                <th className="px-4 py-3 font-bold">Documento</th>
                <th className="px-4 py-3 font-bold">Cliente</th>
                <th className="px-4 py-3 text-right font-bold">Total</th>
                <th className="px-4 py-3 text-right font-bold">Gravada declarada</th>
                <th className="px-4 py-3 text-right font-bold">IGV declarado</th>
                <th className="px-4 py-3 text-right font-bold">Gravada correcta</th>
                <th className="px-4 py-3 text-right font-bold">IGV correcto</th>
                <th className="px-4 py-3 text-right font-bold">Diferencia IGV</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-gray-600">{formatFecha(f.fecha)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <Link href="/comprobantes" className="hover:underline">
                      {f.documento}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{f.clienteNombre}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{f.total.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{f.gravadaDeclarada.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{f.igvDeclarado.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{f.gravadaCorrecta.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{f.igvCorrecto.toFixed(2)}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      f.diferenciaIgv > 0 ? "text-amber-700" : "text-sky-700"
                    }`}
                  >
                    {f.diferenciaIgv >= 0 ? "+" : ""}
                    {f.diferenciaIgv.toFixed(2)}
                  </td>
                </tr>
              ))}
              {filas.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-gray-400">
                    Ningún comprobante tiene diferencia — nada que revisar.
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

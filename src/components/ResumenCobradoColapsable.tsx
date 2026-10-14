"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function ResumenCobradoColapsable({
  hayFiltros,
  resumenPorMetodo,
  totalResumen,
  monedaResumen,
}: {
  hayFiltros: boolean;
  resumenPorMetodo: { metodo: string; label: string; monto: number }[];
  totalResumen: number;
  monedaResumen: string;
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-bold text-emerald-900"
      >
        <span>
          Resumen de lo cobrado{hayFiltros ? " (según filtros aplicados)" : ""}
        </span>
        {abierto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {abierto && (
        <div className="overflow-x-auto border-t border-emerald-200">
          <table className="w-full text-left text-sm">
            <tbody>
              {resumenPorMetodo.map((r) => (
                <tr key={r.metodo} className="border-b border-emerald-100 last:border-0">
                  <td className="px-4 py-2 text-emerald-800">{r.label}</td>
                  <td className="px-4 py-2 text-right text-emerald-800">
                    {monedaResumen} {r.monto.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-emerald-200 font-semibold text-emerald-900">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right">
                  {monedaResumen} {totalResumen.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

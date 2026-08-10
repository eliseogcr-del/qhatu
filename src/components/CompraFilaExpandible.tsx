"use client";

import Link from "next/link";
import { formatFecha } from "@/lib/fecha";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { METODO_PAGO_LABEL, type MetodoPago } from "@/lib/cobranza-tipos";
import type { CompraConSaldo } from "@/utils/supabase/compras";

export default function CompraFilaExpandible({ compra }: { compra: CompraConSaldo }) {
  const [abierta, setAbierta] = useState(false);
  const tienePagos = compra.pagos.length > 0;

  return (
    <>
      <tr className="border-b border-gray-100 last:border-0">
        <td className="px-2 py-3">
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            disabled={!tienePagos}
            aria-label="Ver pagos de esta compra"
            className="flex items-center justify-center text-gray-400 hover:text-gray-600 disabled:opacity-20"
          >
            {abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </button>
        </td>
        <td className="px-4 py-3 font-mono text-xs text-gray-500">
          {compra.id.slice(0, 8).toUpperCase()}
        </td>
        <td className="px-4 py-3 font-medium text-gray-900">
          {compra.proveedor_nombre ?? "—"}
        </td>
        <td className="px-4 py-3 text-gray-600">{compra.almacen_nombre ?? "—"}</td>
        <td className="px-4 py-3 text-gray-600">
          {formatFecha(compra.fecha)}
        </td>
        <td className="px-4 py-3 text-gray-600">
          {compra.moneda} {compra.total.toFixed(2)}
        </td>
        <td className="px-4 py-3 text-gray-600">
          {compra.moneda} {compra.pagado.toFixed(2)}
        </td>
        <td className="px-4 py-3">
          <span
            className={
              compra.saldo > 0
                ? "font-semibold text-red-600"
                : "font-semibold text-green-600"
            }
          >
            {compra.moneda} {compra.saldo.toFixed(2)}
          </span>
        </td>
        <td className="px-4 py-3">
          <span
            className={
              compra.estado === "anulada"
                ? "rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                : "rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700"
            }
          >
            {compra.estado === "anulada" ? "Anulada" : "Registrada"}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <Link
            href={`/compras/${compra.id}`}
            className="text-sm font-medium text-gray-700 hover:underline"
          >
            Ver
          </Link>
        </td>
      </tr>
      {abierta && tienePagos && (
        <tr className="border-b border-gray-100 bg-gray-50">
          <td />
          <td colSpan={9} className="px-4 py-3">
            <table className="w-full text-left text-xs">
              <thead className="text-gray-400">
                <tr>
                  <th className="pb-1 pr-6 font-medium">Fecha de pago</th>
                  <th className="pb-1 pr-6 font-medium">Monto</th>
                  <th className="pb-1 pr-6 font-medium">Método</th>
                  <th className="pb-1 font-medium">Registrado por</th>
                </tr>
              </thead>
              <tbody>
                {compra.pagos.map((p, i) => (
                  <tr key={i} className="border-t border-gray-200 first:border-0">
                    <td className="py-1.5 pr-6 text-gray-600">
                      {formatFecha(p.fecha)}
                    </td>
                    <td className="py-1.5 pr-6 font-medium text-gray-900">
                      {compra.moneda} {p.monto.toFixed(2)}
                    </td>
                    <td className="py-1.5 pr-6 text-gray-600">
                      {METODO_PAGO_LABEL[p.metodoPago as MetodoPago] ?? p.metodoPago}
                    </td>
                    <td className="py-1.5 text-gray-600">{p.usuarioNombre ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

"use client";

import { useState } from "react";

export type VendedorResumen = {
  usuarioId: string;
  nombre: string;
  totalVentas: number;
  totalPagado: number;
  totalAdeudado: number;
};

export type ProductoDetalle = {
  productoId: string;
  nombre: string;
  cantidad: number;
  importeVendido: number;
  importePagado: number;
  importeAdeudado: number;
};

export default function ReportesDashboardVendedores({
  vendedores,
  detallePorVendedor,
  moneda,
}: {
  vendedores: VendedorResumen[];
  detallePorVendedor: Record<string, ProductoDetalle[]>;
  moneda: string;
}) {
  const [seleccionado, setSeleccionado] = useState<string | null>(
    vendedores[0]?.usuarioId ?? null,
  );
  const vendedorSeleccionado = vendedores.find((v) => v.usuarioId === seleccionado);
  const detalle = seleccionado ? (detallePorVendedor[seleccionado] ?? []) : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Ventas por vendedor
        </h2>
        <p className="mb-3 text-xs text-gray-400">
          Haz click en un vendedor para ver el detalle de productos.
        </p>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Vendedor</th>
                <th className="px-4 py-3 text-right font-bold">Total ventas</th>
                <th className="px-4 py-3 text-right font-bold">Total pagado</th>
                <th className="px-4 py-3 text-right font-bold">Total adeudado</th>
              </tr>
            </thead>
            <tbody>
              {vendedores.map((v) => (
                <tr
                  key={v.usuarioId}
                  onClick={() => setSeleccionado(v.usuarioId)}
                  className={`cursor-pointer border-b-2 border-gray-200 last:border-0 ${
                    v.usuarioId === seleccionado ? "bg-emerald-50" : "hover:bg-gray-50"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{v.nombre}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {moneda} {v.totalVentas.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {moneda} {v.totalPagado.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      v.totalAdeudado > 0.009 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {moneda} {v.totalAdeudado.toFixed(2)}
                  </td>
                </tr>
              ))}
              {vendedores.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-400">
                    Sin ventas en este rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Detalle de productos{vendedorSeleccionado ? ` — ${vendedorSeleccionado.nombre}` : ""}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
              <tr>
                <th className="px-4 py-3 font-bold">Descripción</th>
                <th className="px-4 py-3 text-right font-bold">Cantidad</th>
                <th className="px-4 py-3 text-right font-bold">Importe vendido</th>
                <th className="px-4 py-3 text-right font-bold">Importe pagado</th>
                <th className="px-4 py-3 text-right font-bold">Importe adeudado</th>
              </tr>
            </thead>
            <tbody>
              {detalle.map((d) => (
                <tr key={d.productoId} className="border-b-2 border-gray-200 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-900">{d.nombre}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{d.cantidad}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {moneda} {d.importeVendido.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {moneda} {d.importePagado.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium ${
                      d.importeAdeudado > 0.009 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {moneda} {d.importeAdeudado.toFixed(2)}
                  </td>
                </tr>
              ))}
              {detalle.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    {seleccionado
                      ? "Este vendedor no tiene productos vendidos en este rango."
                      : "Selecciona un vendedor para ver el detalle."}
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

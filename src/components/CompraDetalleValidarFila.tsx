"use client";

import { useState } from "react";

const inputClass =
  "w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none";

// Fila de la tabla de "Validar compra": cantidad y costo son editables, y
// el importe se recalcula en el momento (cliente) para que Admin/Logística
// vea el efecto de sus correcciones antes de guardar — el servidor vuelve
// a calcularlo igual al validar (ver validarCompra).
export default function CompraDetalleValidarFila({
  detalleId,
  productoId,
  productoNombre,
  cantidadInicial,
  costoInicial,
}: {
  detalleId: string;
  productoId: string;
  productoNombre: string;
  cantidadInicial: number;
  costoInicial: number;
}) {
  const [cantidad, setCantidad] = useState(cantidadInicial);
  const [costo, setCosto] = useState(costoInicial);
  const importe = Math.round(cantidad * costo * 100) / 100;

  return (
    <tr className="border-b-2 border-gray-200 last:border-0">
      <td className="py-2 text-gray-900">{productoNombre}</td>
      <td className="py-2">
        <input type="hidden" name="detalle_id[]" value={detalleId} />
        <input type="hidden" name="producto_id[]" value={productoId} />
        <input
          type="number"
          step="0.01"
          min="0.01"
          name="cantidad[]"
          required
          value={cantidad}
          onChange={(e) => setCantidad(Number(e.target.value) || 0)}
          className={inputClass}
        />
      </td>
      <td className="py-2">
        <input
          type="number"
          step="0.01"
          min="0"
          name="costo_unitario[]"
          required
          value={costo}
          onChange={(e) => setCosto(Number(e.target.value) || 0)}
          className={inputClass}
        />
      </td>
      <td className="py-2 text-gray-600">{importe.toFixed(2)}</td>
    </tr>
  );
}

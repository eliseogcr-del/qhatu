"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Check } from "lucide-react";

export default function PrecioEspecialRow({
  clienteNombre,
  productoNombre,
  unidadDescripcion,
  precio,
  onActualizar,
  onEliminar,
}: {
  clienteNombre: string;
  productoNombre: string;
  unidadDescripcion: string;
  precio: number;
  onActualizar: (formData: FormData) => void;
  onEliminar: (formData: FormData) => void;
}) {
  const [editando, setEditando] = useState(false);

  if (editando) {
    return (
      <tr className="border-b-2 border-gray-200 bg-amber-50 last:border-0">
        <td colSpan={5} className="px-4 py-3">
          <form action={onActualizar} className="flex flex-wrap items-center gap-3">
            <span className="min-w-[140px] font-medium text-gray-900">{clienteNombre}</span>
            <span className="min-w-[140px] text-gray-600">{productoNombre}</span>
            <span className="text-gray-600">{unidadDescripcion}</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              name="precio"
              defaultValue={precio}
              required
              autoFocus
              className="w-28 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline"
            >
              <Check size={14} />
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:underline"
            >
              <X size={14} />
              Cancelar
            </button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b-2 border-gray-200 last:border-0">
      <td className="px-4 py-3 font-medium text-gray-900">{clienteNombre}</td>
      <td className="px-4 py-3 text-gray-600">{productoNombre}</td>
      <td className="px-4 py-3 text-gray-600">{unidadDescripcion}</td>
      <td className="px-4 py-3 text-gray-600">{precio}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:underline"
          >
            <Pencil size={14} />
            Editar
          </button>
          <form action={onEliminar}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:underline"
            >
              <Trash2 size={14} />
              Quitar
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

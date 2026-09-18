"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Check } from "lucide-react";

export default function PromocionRow({
  nombre,
  productoNombre,
  monto,
  activa,
  onActualizar,
  onAlternarActiva,
}: {
  nombre: string;
  productoNombre: string;
  monto: number;
  activa: boolean;
  onActualizar: (formData: FormData) => void;
  onAlternarActiva: (activa: boolean) => void | Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [, startTransition] = useTransition();

  if (editando) {
    return (
      <tr className="border-b-2 border-gray-200 bg-amber-50 last:border-0">
        <td colSpan={5} className="px-4 py-3">
          <form action={onActualizar} className="flex flex-wrap items-center gap-3">
            <input
              name="nombre"
              defaultValue={nombre}
              required
              autoFocus
              className="min-w-[200px] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <span className="min-w-[140px] text-gray-500">{productoNombre}</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              name="monto"
              defaultValue={monto}
              required
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
      <td className="px-4 py-3 font-medium text-gray-900">{nombre}</td>
      <td className="px-4 py-3 text-gray-600">{productoNombre}</td>
      <td className="px-4 py-3 text-gray-600">{monto.toFixed(2)}</td>
      <td className="px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            defaultChecked={activa}
            onChange={(e) => {
              const checked = e.target.checked;
              startTransition(() => onAlternarActiva(checked));
            }}
            className="h-4 w-4 rounded border-gray-300"
          />
          {activa ? "Activa" : "Inactiva"}
        </label>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:underline"
        >
          <Pencil size={14} />
          Editar
        </button>
      </td>
    </tr>
  );
}

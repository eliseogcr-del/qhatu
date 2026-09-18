"use client";

import { useState, useTransition } from "react";
import { Pencil, X, Check } from "lucide-react";

function aInputLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatearFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default function PromocionRow({
  nombre,
  productoNombre,
  cantidadMinima,
  inicio,
  fin,
  activa,
  onActualizar,
  onAlternarActiva,
}: {
  nombre: string;
  productoNombre: string;
  cantidadMinima: number;
  inicio: string | null;
  fin: string | null;
  activa: boolean;
  onActualizar: (formData: FormData) => void;
  onAlternarActiva: (activa: boolean) => void | Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [, startTransition] = useTransition();

  if (editando) {
    return (
      <tr className="border-b-2 border-gray-200 bg-amber-50 last:border-0">
        <td colSpan={7} className="px-4 py-3">
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
              name="cantidad_minima"
              defaultValue={cantidadMinima}
              required
              title="Cantidad mínima"
              className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="datetime-local"
              name="promocion_inicio"
              defaultValue={aInputLocal(inicio)}
              title="Inicio de campaña"
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="datetime-local"
              name="promocion_fin"
              defaultValue={aInputLocal(fin)}
              title="Fin de campaña"
              className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
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
      <td className="px-4 py-3 text-gray-600">{cantidadMinima}</td>
      <td className="px-4 py-3 text-gray-600">{formatearFecha(inicio)}</td>
      <td className="px-4 py-3 text-gray-600">{formatearFecha(fin)}</td>
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

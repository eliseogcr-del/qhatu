"use client";

import { useId, useState, useTransition } from "react";
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

const inputEditClass =
  "w-full min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none";

export default function PromocionRow({
  nombre,
  productoNombre,
  cantidadMinima,
  cantidadRegalo,
  precio,
  inicio,
  fin,
  activa,
  onActualizar,
  onAlternarActiva,
}: {
  nombre: string;
  productoNombre: string;
  cantidadMinima: number;
  cantidadRegalo: number;
  precio: number;
  inicio: string | null;
  fin: string | null;
  activa: boolean;
  onActualizar: (formData: FormData) => void;
  onAlternarActiva: (activa: boolean) => void | Promise<void>;
}) {
  const [editando, setEditando] = useState(false);
  const [, startTransition] = useTransition();
  // El formulario de edición vive fuera de la tabla (asociado por id vía
  // el atributo `form` de cada input) para que cada campo pueda quedar en
  // su propia celda, alineado bajo el encabezado que le corresponde, en
  // vez de amontonarse en una sola celda con flex-wrap.
  const formId = useId();

  const estadoCelda = (
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
  );

  if (editando) {
    return (
      <tr className="border-b-2 border-gray-200 bg-amber-50 last:border-0">
        <td className="px-4 py-3">
          <input
            form={formId}
            name="nombre"
            defaultValue={nombre}
            required
            autoFocus
            className={inputEditClass}
          />
        </td>
        <td className="px-4 py-3 text-gray-500">{productoNombre}</td>
        <td className="px-4 py-3">
          <input
            form={formId}
            type="number"
            step="0.01"
            min="0.01"
            name="cantidad_minima"
            defaultValue={cantidadMinima}
            required
            title="Cantidad mínima"
            className={inputEditClass}
          />
        </td>
        <td className="px-4 py-3">
          <input
            form={formId}
            type="number"
            step="0.01"
            min="0.01"
            name="cantidad_regalo"
            defaultValue={cantidadRegalo}
            required
            title="Cantidad a regalar"
            className={inputEditClass}
          />
        </td>
        <td className="px-4 py-3">
          <input
            form={formId}
            type="number"
            step="0.01"
            min="0"
            name="precio"
            defaultValue={precio}
            required
            title="Precio"
            className={inputEditClass}
          />
        </td>
        <td className="px-4 py-3">
          <input
            form={formId}
            type="datetime-local"
            name="promocion_inicio"
            defaultValue={aInputLocal(inicio)}
            title="Inicio de campaña"
            className={inputEditClass}
          />
        </td>
        <td className="px-4 py-3">
          <input
            form={formId}
            type="datetime-local"
            name="promocion_fin"
            defaultValue={aInputLocal(fin)}
            title="Fin de campaña"
            className={inputEditClass}
          />
        </td>
        <td className="px-4 py-3">{estadoCelda}</td>
        <td className="px-4 py-3">
          <form
            id={formId}
            action={onActualizar}
            className="flex items-center justify-end gap-3 whitespace-nowrap"
          >
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
      <td className="px-4 py-3 text-gray-600">{cantidadRegalo}</td>
      <td className="px-4 py-3 text-gray-600">{precio.toFixed(2)}</td>
      <td className="px-4 py-3 text-gray-600">{formatearFecha(inicio)}</td>
      <td className="px-4 py-3 text-gray-600">{formatearFecha(fin)}</td>
      <td className="px-4 py-3">{estadoCelda}</td>
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

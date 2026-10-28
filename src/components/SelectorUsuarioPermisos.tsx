"use client";

import { useRouter } from "next/navigation";
import { ROL_LABEL, type Rol } from "@/lib/roles";

type UsuarioOpcion = { id: string; nombre: string; rol: string };

export default function SelectorUsuarioPermisos({
  usuarios,
  usuarioIdSeleccionado,
}: {
  usuarios: UsuarioOpcion[];
  usuarioIdSeleccionado?: string;
}) {
  const router = useRouter();
  const seleccionado = usuarios.find((u) => u.id === usuarioIdSeleccionado);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={usuarioIdSeleccionado ?? ""}
        onChange={(e) => {
          const id = e.target.value;
          router.push(id ? `/usuarios/permisos?usuario_id=${id}` : "/usuarios/permisos");
        }}
        className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
      >
        <option value="">Selecciona un usuario...</option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
          </option>
        ))}
      </select>
      {seleccionado && (
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
          {ROL_LABEL[seleccionado.rol as Rol] ?? seleccionado.rol}
        </span>
      )}
    </div>
  );
}

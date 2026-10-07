"use client";

import { useRouter, usePathname } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

type Opcion = { id: string; nombre: string };

export default function ObjetivosFiltroForm({
  periodo,
  vendedorId,
  modo,
  vendedores,
}: {
  periodo: string;
  vendedorId: string;
  modo: "cobrado" | "total";
  vendedores: Opcion[];
}) {
  const router = useRouter();
  const pathname = usePathname();

  const navegar = (params: { periodo: string; vendedor_id: string; modo: string }) => {
    const usp = new URLSearchParams();
    usp.set("periodo", params.periodo);
    if (params.vendedor_id) usp.set("vendedor_id", params.vendedor_id);
    usp.set("modo", params.modo);
    router.push(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-700">
        <SlidersHorizontal size={16} className="text-gray-500" />
        Filtros
      </div>
      <div className="flex flex-wrap items-end gap-4 p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Período</label>
          <input
            type="month"
            value={periodo}
            onChange={(e) => navegar({ periodo: e.target.value, vendedor_id: vendedorId, modo })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Vendedor</label>
          <select
            value={vendedorId}
            onChange={(e) => navegar({ periodo, vendedor_id: e.target.value, modo })}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Todos (empresa)</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Ventas a considerar</label>
          <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm">
            <button
              type="button"
              onClick={() => navegar({ periodo, vendedor_id: vendedorId, modo: "cobrado" })}
              className={`px-3 py-2 font-medium ${
                modo === "cobrado" ? "bg-emerald-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Cobradas (lo pagado)
            </button>
            <button
              type="button"
              onClick={() => navegar({ periodo, vendedor_id: vendedorId, modo: "total" })}
              className={`border-l border-gray-300 px-3 py-2 font-medium ${
                modo === "total" ? "bg-emerald-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Totales (facturado)
            </button>
          </div>
        </div>
      </div>
      <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
        {modo === "cobrado"
          ? "Cada venta cuenta por lo que se ha cobrado de ella hasta hoy, total o parcial (ej. vendida S/500, cobrada S/450 → cuenta S/450)."
          : "Cada venta cuenta por su importe facturado completo, sin importar cuánto se haya cobrado."}
      </p>
    </div>
  );
}

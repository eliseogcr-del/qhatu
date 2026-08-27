"use client";

import { useRouter, usePathname } from "next/navigation";

export default function ReportesDashboardFiltroForm({
  desde,
  hasta,
}: {
  desde: string;
  hasta: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const navegar = (params: { desde: string; hasta: string }) => {
    const usp = new URLSearchParams();
    usp.set("desde", params.desde);
    usp.set("hasta", params.hasta);
    router.push(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="mb-6 flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Desde</label>
        <input
          type="date"
          value={desde}
          onChange={(e) => navegar({ desde: e.target.value, hasta })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Hasta</label>
        <input
          type="date"
          value={hasta}
          onChange={(e) => navegar({ desde, hasta: e.target.value })}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={() => router.push(pathname)}
        className="text-sm font-medium text-gray-500 hover:underline"
      >
        Restablecer al mes actual
      </button>
    </div>
  );
}

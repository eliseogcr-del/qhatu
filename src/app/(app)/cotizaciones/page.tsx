import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireComercial } from "@/utils/supabase/session";
import { formatFecha } from "@/lib/fecha";

export default async function CotizacionesPage() {
  const supabase = await createClient();
  await requireComercial(supabase);

  const { data: cotizaciones } = await supabase
    .from("cotizaciones")
    .select("id, numero, fecha, total, moneda, pedido_id, clientes(nombre), prospecto_nombre")
    .order("numero", { ascending: false });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Cotizaciones</h1>
        <Link
          href="/cotizaciones/nuevo"
          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <Plus size={16} />
          Nueva cotización
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">N°</th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cotizaciones?.map((c) => {
              const cliente = c.clientes as unknown as { nombre: string } | null;
              return (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/cotizaciones/${c.id}`} className="font-medium text-emerald-700 hover:underline">
                      #{c.numero}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatFecha(c.fecha)}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {cliente?.nombre ?? c.prospecto_nombre ?? "—"}
                    {!cliente && c.prospecto_nombre && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                        Prospecto
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-900">
                    {c.moneda} {Number(c.total).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    {c.pedido_id ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                        Convertida a pedido
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                        Vigente
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {(!cotizaciones || cotizaciones.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                  Aún no hay cotizaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

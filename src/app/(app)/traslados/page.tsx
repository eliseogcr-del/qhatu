import Link from "next/link";
import { Plus, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function TrasladosPage() {
  const supabase = await createClient();

  const { data: traslados, error } = await supabase
    .from("traslados")
    .select(
      "id, fecha, nota, almacen_origen:almacen_origen_id(nombre), almacen_destino:almacen_destino_id(nombre), usuarios(nombre), traslado_detalle(id, cantidad, productos(nombre))",
    )
    .order("fecha", { ascending: false })
    .limit(100);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Traslados</h1>
          <Link
            href="/traslados/nuevo"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={16} />
            Nuevo traslado
          </Link>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Movimientos de mercadería entre almacenes (últimos 100). Un
          vendedor solo ve los traslados donde su propio almacén es el
          origen o el destino.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="space-y-4">
          {traslados?.map((t) => {
            const origen = t.almacen_origen as unknown as { nombre: string } | null;
            const destino = t.almacen_destino as unknown as { nombre: string } | null;
            const usuario = t.usuarios as unknown as { nombre: string | null } | null;
            const lineas = t.traslado_detalle as unknown as {
              id: string;
              cantidad: number;
              productos: { nombre: string } | null;
            }[];

            return (
              <div
                key={t.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    <span>{origen?.nombre ?? "—"}</span>
                    <ArrowRight size={14} className="text-gray-400" />
                    <span>{destino?.nombre ?? "—"}</span>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{new Date(t.fecha).toLocaleString("es-PE")}</p>
                    <p>{usuario?.nombre ?? "—"}</p>
                  </div>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Producto</th>
                      <th className="px-4 py-2 font-medium">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l) => (
                      <tr key={l.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2 text-gray-900">
                          {l.productos?.nombre ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-600">{l.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {t.nota && (
                  <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
                    {t.nota}
                  </p>
                )}
              </div>
            );
          })}

          {traslados?.length === 0 && (
            <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
              Aún no hay traslados registrados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

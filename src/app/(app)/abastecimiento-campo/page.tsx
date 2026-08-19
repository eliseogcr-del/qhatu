import Link from "next/link";
import { formatFechaHora } from "@/lib/fecha";
import { Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export default async function AbastecimientoCampoPage() {
  const supabase = await createClient();

  const { data: abastecimientos, error } = await supabase
    .from("abastecimientos_campo")
    .select(
      "id, fecha, nota, almacenes(nombre), proveedores(nombre), usuarios(nombre), abastecimiento_campo_detalle(id, cantidad, productos(nombre))",
    )
    .order("fecha", { ascending: false })
    .limit(100);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Abastecimiento en campo</h1>
          <Link
            href="/abastecimiento-campo/nuevo"
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            <Plus size={16} />
            Nuevo abastecimiento
          </Link>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Mercadería que un vendedor recogió de un proveedor directamente en
          ruta, sin documento de compra (últimos 100).
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error.message}
          </p>
        )}

        <div className="space-y-4">
          {abastecimientos?.map((a) => {
            const almacen = a.almacenes as unknown as { nombre: string } | null;
            const proveedor = a.proveedores as unknown as { nombre: string } | null;
            const usuario = a.usuarios as unknown as { nombre: string | null } | null;
            const lineas = a.abastecimiento_campo_detalle as unknown as {
              id: string;
              cantidad: number;
              productos: { nombre: string } | null;
            }[];

            return (
              <div
                key={a.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {almacen?.nombre ?? "—"}
                      {proveedor && (
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          de {proveedor.nombre}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{formatFechaHora(a.fecha)}</p>
                    <p>{usuario?.nombre ?? "—"}</p>
                  </div>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="border-b-2 border-sky-200 bg-sky-50 text-gray-700">
                    <tr>
                      <th className="px-4 py-2 font-bold">Producto</th>
                      <th className="px-4 py-2 font-bold">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map((l) => (
                      <tr key={l.id} className="border-b-2 border-gray-200 last:border-0">
                        <td className="px-4 py-2 text-gray-900">
                          {l.productos?.nombre ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-600">{l.cantidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {a.nota && (
                  <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
                    {a.nota}
                  </p>
                )}
              </div>
            );
          })}

          {abastecimientos?.length === 0 && (
            <p className="rounded-xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-400 shadow-sm">
              Aún no hay abastecimientos en campo registrados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

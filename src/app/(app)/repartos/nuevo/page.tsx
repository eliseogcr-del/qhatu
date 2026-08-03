import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import RepartoForm from "@/components/RepartoForm";
import { createReparto } from "../actions";

export default async function NuevoRepartoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; pedido_id?: string }>;
}) {
  const { error, pedido_id } = await searchParams;

  const supabase = await createClient();
  const [{ data: pedidosData }, { data: usuarios }] = await Promise.all([
    supabase
      .from("pedidos")
      .select("id, fecha, estado, clientes(nombre)")
      .not("estado", "in", "(cerrado,cancelado)")
      .order("fecha", { ascending: false }),
    supabase.from("usuarios").select("id, nombre").eq("activo", true),
  ]);

  const pedidos = (pedidosData ?? []).map((p) => {
    const cliente = p.clientes as unknown as { nombre: string } | null;
    const fecha = new Date(p.fecha).toLocaleDateString("es-PE");
    return { id: p.id, label: `${cliente?.nombre ?? "—"} — ${fecha}` };
  });

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Asignar reparto
          </h1>
          <Link
            href="/repartos"
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <RepartoForm
            action={createReparto}
            error={error}
            submitLabel="Asignar reparto"
            pedidos={pedidos}
            usuarios={usuarios ?? []}
            pedidoFijo={!!pedido_id}
            initialValues={
              pedido_id
                ? {
                    pedido_id,
                    fecha_reparto: null,
                    tipo_transporte: "repartidor_propio",
                    transportista_nombre: null,
                    repartidor_id: null,
                    estado: "pendiente",
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}

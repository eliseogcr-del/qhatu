import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import RepartoForm from "@/components/RepartoForm";
import { updateReparto } from "../../actions";

export default async function EditarRepartoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const [{ data: reparto }, { data: pedidosData }, { data: usuarios }] =
    await Promise.all([
      supabase.from("repartos").select("*").eq("id", id).single(),
      supabase
        .from("pedidos")
        .select("id, fecha, clientes(nombre)")
        .order("fecha", { ascending: false }),
      supabase.from("usuarios").select("id, nombre").eq("activo", true),
    ]);

  if (!reparto) notFound();

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
            Editar reparto
          </h1>
          <Link
            href="/repartos"
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <RepartoForm
            action={updateReparto.bind(null, id)}
            initialValues={reparto}
            error={error}
            submitLabel="Guardar cambios"
            pedidos={pedidos}
            usuarios={usuarios ?? []}
          />
        </div>
      </div>
    </div>
  );
}

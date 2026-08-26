import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { requireComercial } from "@/utils/supabase/session";
import SubmitButton from "@/components/SubmitButton";
import { enviarAPedido } from "../../actions";

export default async function EnviarAPedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const session = await requireComercial(supabase);
  const { empresaId, almacenId } = session;

  const { data: cotizacion } = await supabase
    .from("cotizaciones")
    .select("id, numero, pedido_id")
    .eq("id", id)
    .maybeSingle();

  if (!cotizacion) notFound();
  if (cotizacion.pedido_id) redirect(`/cotizaciones/${id}`);

  const { data: almacenes } = almacenId
    ? { data: null }
    : await supabase
        .from("almacenes")
        .select("id, nombre")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .order("nombre");

  return (
    <div className="p-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Enviar cotización #{cotizacion.numero} a pedido
          </h1>
          <Link
            href={`/cotizaciones/${id}`}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 shadow-sm">
          <form action={enviarAPedido.bind(null, id)} className="space-y-6">
            <p className="text-sm text-gray-600">
              Esto crea un Pedido nuevo con los mismos productos, cantidades y
              precios de la cotización. Elige el almacén/local que va a
              atender este pedido.
            </p>

            {almacenes && almacenes.length > 0 && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Almacén / Local
                </label>
                <select
                  name="almacen_id"
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">Selecciona un local</option>
                  {almacenes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <SubmitButton icon={<Send size={16} />} pendingLabel="Enviando...">
              Enviar a pedido
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}

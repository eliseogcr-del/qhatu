import Link from "next/link";
import ClienteForm from "@/components/ClienteForm";
import { createCliente } from "../actions";

export default async function NuevoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Nuevo cliente</h1>
          <Link
            href="/clientes"
            className="text-sm font-medium text-gray-600 hover:underline"
          >
            ← Volver al listado
          </Link>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <ClienteForm
            action={createCliente}
            error={error}
            submitLabel="Crear cliente"
          />
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProveedorForm from "@/components/ProveedorForm";
import { createProveedor } from "../actions";

export default async function NuevoProveedorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            Nuevo proveedor
          </h1>
          <Link
            href="/proveedores"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver al listado
          </Link>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <ProveedorForm
            action={createProveedor}
            error={error}
            submitLabel="Crear proveedor"
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// A diferencia de un <Link href="/ventas">, esto vuelve exactamente a la
// página anterior en el historial del navegador — si venías de una
// grilla con filtros aplicados, esos filtros ya están en esa URL previa
// y se conservan, en vez de perderse al ir a un href fijo sin query.
export default function VolverAtras({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={className ?? "flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"}
    >
      <ArrowLeft size={16} />
      {children}
    </button>
  );
}

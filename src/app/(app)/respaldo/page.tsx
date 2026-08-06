import { DatabaseBackup, FolderDown } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";

export default async function RespaldoPage() {
  const supabase = await createClient();
  await requireAdmin(supabase);

  return (
    <div className="p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <DatabaseBackup size={24} className="text-emerald-700" />
          <h1 className="text-2xl font-semibold text-gray-900">Respaldo de datos</h1>
        </div>
        <p className="mb-6 text-sm text-gray-500">
          Descarga una copia de todos tus registros (clientes, productos,
          pedidos, ventas, cobranzas, compras, kardex, etc.) en un archivo ZIP
          con un Excel por cada tabla. Solo visible para administradores.
        </p>

        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esto no es un respaldo técnico de la base de datos — no se puede
          &quot;restaurar&quot; con un clic. Es una copia de tus registros de
          negocio, pensada como red de seguridad mientras el proyecto esté en
          el plan gratuito de Supabase (que no incluye copias automáticas).
          Se recomienda descargarlo periódicamente, por ejemplo una vez por
          semana, y guardarlo en tu computadora.
        </div>

        <a
          href="/respaldo/descargar"
          className="flex w-fit items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          <FolderDown size={16} />
          Descargar respaldo completo (ZIP)
        </a>
      </div>
    </div>
  );
}

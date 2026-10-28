import Link from "next/link";
import { ArrowLeft, KeyRound, Save } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/session";
import { obtenerOpcionesUsuario } from "@/utils/supabase/opciones";
import { OPCIONES_SISTEMA, GRUPOS_OPCIONES } from "@/lib/opciones-sistema";
import SelectorUsuarioPermisos from "@/components/SelectorUsuarioPermisos";
import SubmitButton from "@/components/SubmitButton";
import { guardarPermisosUsuario } from "./actions";

export default async function PermisosPage({
  searchParams,
}: {
  searchParams: Promise<{ usuario_id?: string; error?: string; guardado?: string }>;
}) {
  const { usuario_id: usuarioIdParam, error, guardado } = await searchParams;
  const supabase = await createClient();
  const { empresaId } = await requireAdmin(supabase);

  const { data: usuariosRaw } = await supabase
    .from("usuarios")
    .select("id, nombre, rol")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .neq("rol", "admin")
    .order("nombre");

  const usuarios = usuariosRaw ?? [];
  const usuarioSeleccionado = usuarios.find((u) => u.id === usuarioIdParam);

  let opcionesConcedidas = new Set<string>();
  let puedeModificarPrecios = false;
  let puedeAplicarDescuento = false;
  if (usuarioSeleccionado) {
    const [opciones, { data: flags }] = await Promise.all([
      obtenerOpcionesUsuario(supabase, usuarioSeleccionado.id),
      supabase
        .from("usuarios")
        .select("puede_modificar_precios, puede_aplicar_descuento")
        .eq("id", usuarioSeleccionado.id)
        .single(),
    ]);
    opcionesConcedidas = opciones;
    puedeModificarPrecios = flags?.puede_modificar_precios ?? false;
    puedeAplicarDescuento = flags?.puede_aplicar_descuento ?? false;
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound size={24} className="text-emerald-700" />
            <h1 className="text-2xl font-semibold text-gray-900">Permisos</h1>
          </div>
          <Link
            href="/usuarios"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:underline"
          >
            <ArrowLeft size={16} />
            Volver a Usuarios
          </Link>
        </div>

        <p className="mb-6 text-sm text-gray-500">
          Qué ve y qué puede hacer cada usuario ya no depende solo de su
          rol — se configura acá, uno por uno. El administrador siempre
          tiene acceso a todo, sin importar lo que esté marcado aquí.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {guardado && (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Permisos guardados.
          </p>
        )}

        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
          <label className="mb-2 block text-sm font-medium text-gray-700">Usuario</label>
          <SelectorUsuarioPermisos usuarios={usuarios} usuarioIdSeleccionado={usuarioSeleccionado?.id} />
          {usuarios.length === 0 && (
            <p className="mt-3 text-sm text-gray-500">
              No hay usuarios activos distintos de administrador todavía.
            </p>
          )}
        </div>

        {usuarioSeleccionado && (
          <form action={guardarPermisosUsuario.bind(null, usuarioSeleccionado.id)} className="space-y-6">
            {GRUPOS_OPCIONES.map((grupo) => {
              const items = OPCIONES_SISTEMA.filter((o) => o.grupo === grupo);
              return (
                <div key={grupo} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {grupo}
                  </h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {items.map((item) => (
                      <label key={item.codigo} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          name="opciones[]"
                          value={item.codigo}
                          defaultChecked={opcionesConcedidas.has(item.codigo)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        {item.etiqueta}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">
                Permisos especiales
              </h2>
              <p className="mb-4 text-xs text-gray-500">
                Antes eran un interruptor único para toda la empresa — ahora se configuran por usuario.
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="puede_modificar_precios"
                    defaultChecked={puedeModificarPrecios}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Puede modificar precios a mano en Pedidos, Ventas y Cotizaciones
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="puede_aplicar_descuento"
                    defaultChecked={puedeAplicarDescuento}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Puede aplicar descuento al registrar/editar una venta
                </label>
              </div>
            </div>

            <SubmitButton icon={<Save size={16} />}>Guardar permisos</SubmitButton>
          </form>
        )}
      </div>
    </div>
  );
}

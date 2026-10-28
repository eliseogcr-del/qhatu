-- Hasta ahora qué opciones del menú ve cada quien dependía solo del rol
-- (SidebarNav.tsx: gruposPorRol). Se pide poder personalizarlo por
-- usuario — un vendedor puntual podría necesitar ver algo que su rol no
-- trae por defecto, sin tener que cambiarle el rol a todos los de su
-- tipo. El rol sigue existiendo (determina almacén, RLS, y sigue
-- mostrándose como etiqueta), pero el acceso a cada opción del sistema
-- ahora se guarda aparte, por usuario. Admin siempre ve/puede todo, sin
-- necesidad de filas acá.

create table public.usuario_opciones (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  opcion_codigo text not null,
  primary key (usuario_id, opcion_codigo)
);

alter table public.usuario_opciones enable row level security;

-- El propio usuario necesita poder leer SUS opciones (las usa el layout
-- para armar su menú, y el proxy/middleware para bloquear navegación
-- directa) — pero no las de nadie más.
create policy "usuario_opciones: el propio usuario ve las suyas" on public.usuario_opciones
  for select using (usuario_id = auth.uid());

-- Solo admin administra permisos, y solo de usuarios de su propia
-- empresa (es_admin()/current_empresa_id() son security definer, ya
-- usados en el resto de políticas de este estilo).
create policy "usuario_opciones: admin administra las de su empresa" on public.usuario_opciones
  for all using (
    public.es_admin()
    and exists (
      select 1 from public.usuarios u
      where u.id = usuario_opciones.usuario_id and u.empresa_id = public.current_empresa_id()
    )
  )
  with check (
    public.es_admin()
    and exists (
      select 1 from public.usuarios u
      where u.id = usuario_opciones.usuario_id and u.empresa_id = public.current_empresa_id()
    )
  );

grant select, insert, update, delete on public.usuario_opciones to authenticated;

-- "Modificar precios" y "Activar descuento" eran un interruptor único
-- para toda la empresa (configuracion_precios.precios_bloqueados /
-- descuento_habilitado) — pasan a ser por usuario, mismo criterio que
-- las opciones de menú. Admin siempre puede ambas cosas, sin importar
-- estas columnas (ver getEmpresaSession).
alter table public.usuarios
  add column if not exists puede_modificar_precios boolean not null default false,
  add column if not exists puede_aplicar_descuento boolean not null default false;

-- ── Precarga: nada le cambia a nadie el día que se despliega esto ────
--
-- 1) Opciones de menú: a cada usuario activo no-admin se le siembran los
--    códigos que HOY ya ve según su rol (y, para "vendedor", según si su
--    almacén es digital o no) — exactamente lo que gruposPorRol()
--    (SidebarNav.tsx) calcula hoy. De acá en adelante el admin ajusta
--    desde el nuevo módulo de Permisos.
insert into public.usuario_opciones (usuario_id, opcion_codigo)
select u.id, codigo
from public.usuarios u
left join public.almacenes a on a.id = u.almacen_id
cross join lateral unnest(
  case u.rol
    when 'logistica' then array[
      '/pedidos', '/cotizaciones',
      '/repartos', '/traslados', '/abastecimiento-campo', '/produccion',
      '/inventario', '/kardex', '/reportes/cuadro-control', '/promociones',
      '/ventas/rapida', '/ventas', '/comprobantes-libres'
    ]
    when 'repartidor' then array['/mis-repartos']
    when 'produccion' then array['/produccion']
    when 'contador' then array['/comprobantes', '/comprobantes-libres']
    else case when coalesce(a.es_digital, false)
      then array[
        '/ventas/directa', '/ventas/rapida',
        '/clientes', '/pedidos', '/cotizaciones',
        '/repartos', '/traslados', '/inventario', '/kardex', '/reportes/cuadro-control',
        '/ventas'
      ]
      else array[
        '/ventas/rapida',
        '/cotizaciones',
        '/traslados', '/abastecimiento-campo', '/reportes/cuadro-control',
        '/ventas/mis-ventas'
      ]
    end
  end
) as codigo
where u.rol <> 'admin' and u.activo = true
on conflict do nothing;

-- 2) Modificar precios / Activar descuento: se copia el valor que hoy
--    rige para TODA la empresa, para cada usuario de esa empresa — si
--    antes el descuento estaba habilitado para todos, sigue estándolo
--    hoy para todos (por usuario); si los precios estaban desbloqueados,
--    igual. Empresas sin fila de configuración quedan con el default
--    seguro (false/false), que es el mismo comportamiento que ya tenían
--    (preciosBloqueados/descuentoHabilitado también default a eso).
update public.usuarios u
set puede_modificar_precios = not coalesce(cp.precios_bloqueados, true),
    puede_aplicar_descuento = coalesce(cp.descuento_habilitado, false)
from public.configuracion_precios cp
where cp.empresa_id = u.empresa_id;

-- Unidades de medida: hasta ahora todo se pedía/vendía en unidades sueltas.
-- Esto permite manejar otras presentaciones (ej. DOCENA = 12 unidades) sin
-- tocar el precio unitario -- el stock siempre se descuenta en unidades
-- base, convirtiendo cantidad * unidades_medida.cantidad.

create table public.unidades_medida (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  codigo text not null,
  descripcion text not null,
  cantidad numeric(12, 2) not null default 1,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.unidades_medida enable row level security;

create policy "unidades_medida: select por empresa" on public.unidades_medida
  for select using (empresa_id = public.current_empresa_id());
create policy "unidades_medida: insert por empresa" on public.unidades_medida
  for insert with check (empresa_id = public.current_empresa_id());
create policy "unidades_medida: update por empresa" on public.unidades_medida
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

grant select, insert, update on public.unidades_medida to authenticated;

create unique index if not exists idx_unidades_medida_empresa_codigo
  on public.unidades_medida (empresa_id, codigo);

-- Bootstrap: la unidad base "UNIDAD" (factor 1) para cada empresa ya
-- sembrada -- todo producto/línea existente queda anclado a esta.
insert into public.unidades_medida (empresa_id, codigo, descripcion, cantidad, activo)
select id, 'UND', 'UNIDAD', 1, true from public.empresas;

-- productos: unidad de medida por defecto, la que se preselecciona al
-- pedir/vender ese producto.
alter table public.productos add column unidad_medida_id uuid references public.unidades_medida (id);

update public.productos p
set unidad_medida_id = u.id
from public.unidades_medida u
where u.empresa_id = p.empresa_id and u.codigo = 'UND';

alter table public.productos alter column unidad_medida_id set not null;

-- pedido_detalle / venta_detalle: la unidad elegida en esa línea puntual
-- (puede diferir de la unidad por defecto del producto). Nullable a nivel
-- de BD para no romper filas históricas al migrar; la aplicación la
-- completa siempre de acá en adelante.
alter table public.pedido_detalle add column unidad_medida_id uuid references public.unidades_medida (id);
alter table public.venta_detalle add column unidad_medida_id uuid references public.unidades_medida (id);

update public.pedido_detalle d
set unidad_medida_id = u.id
from public.pedidos p
join public.unidades_medida u on u.empresa_id = p.empresa_id and u.codigo = 'UND'
where d.pedido_id = p.id and d.unidad_medida_id is null;

update public.venta_detalle d
set unidad_medida_id = u.id
from public.ventas v
join public.unidades_medida u on u.empresa_id = v.empresa_id and u.codigo = 'UND'
where d.venta_id = v.id and d.unidad_medida_id is null;

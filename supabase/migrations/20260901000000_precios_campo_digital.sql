-- Reemplaza el precio único de producto por dos precios de lista: Precio
-- Campo (ventas por almacén principal/móvil) y Precio Digital (ventas por
-- el almacén marcado como digital). Se agrega también un precio especial
-- por cliente+producto (para clientes de alto volumen) y un interruptor
-- global para bloquear/desbloquear la edición manual del precio en
-- pedidos, ventas y cotizaciones.

alter table public.productos add column precio_campo numeric(12, 2) not null default 0;
alter table public.productos add column precio_digital numeric(12, 2) not null default 0;

update public.productos
set precio_campo = precio_venta,
    precio_digital = precio_venta;

alter table public.productos drop column precio_venta;

-- Marca qué almacén corresponde al canal de venta digital (ej. "Almacén
-- Digital"). El resto (principal, móviles, secundario, etc.) usa Precio
-- Campo por defecto.
alter table public.almacenes add column es_digital boolean not null default false;

create table public.precios_especiales_cliente (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  cliente_id uuid not null references public.clientes (id),
  producto_id uuid not null references public.productos (id),
  precio numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, cliente_id, producto_id)
);

create index idx_precios_especiales_cliente_cliente_id
  on public.precios_especiales_cliente (cliente_id);
create index idx_precios_especiales_cliente_producto_id
  on public.precios_especiales_cliente (producto_id);

alter table public.precios_especiales_cliente enable row level security;

-- Cualquier usuario de la empresa puede leerla (la necesita el cálculo de
-- precio al armar un pedido/venta/cotización, sin importar el rol), pero
-- solo un admin puede crear/editar/borrar precios especiales.
create policy "precios_especiales_cliente: select por empresa" on public.precios_especiales_cliente
  for select using (empresa_id = public.current_empresa_id());

create policy "precios_especiales_cliente: insert solo admin" on public.precios_especiales_cliente
  for insert with check (
    empresa_id = public.current_empresa_id()
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "precios_especiales_cliente: update solo admin" on public.precios_especiales_cliente
  for update using (
    empresa_id = public.current_empresa_id()
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
  )
  with check (empresa_id = public.current_empresa_id());

create policy "precios_especiales_cliente: delete solo admin" on public.precios_especiales_cliente
  for delete using (
    empresa_id = public.current_empresa_id()
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

grant select, insert, update, delete on public.precios_especiales_cliente to authenticated;

-- Interruptor único por empresa: bloqueado (default) = el precio de
-- pedidos/ventas/cotizaciones se calcula solo y no se puede tocar a mano.
-- Desbloqueado = vuelve a ser editable, como era antes de este cambio.
create table public.configuracion_precios (
  empresa_id uuid primary key references public.empresas (id),
  precios_bloqueados boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.configuracion_precios enable row level security;

create policy "configuracion_precios: select por empresa" on public.configuracion_precios
  for select using (empresa_id = public.current_empresa_id());

create policy "configuracion_precios: insert solo admin" on public.configuracion_precios
  for insert with check (
    empresa_id = public.current_empresa_id()
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
  );

create policy "configuracion_precios: update solo admin" on public.configuracion_precios
  for update using (
    empresa_id = public.current_empresa_id()
    and exists (select 1 from public.usuarios u where u.id = auth.uid() and u.rol = 'admin')
  )
  with check (empresa_id = public.current_empresa_id());

grant select, insert, update on public.configuracion_precios to authenticated;

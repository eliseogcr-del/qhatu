-- Módulo 3 del plan: catálogo de productos, y proveedores como su
-- dependencia directa (productos.proveedor_id).

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  nombre text not null,
  ruc text,
  contacto text,
  telefono text,
  correo_electronico text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  codigo_barra text,
  codigo_proveedor text,
  nombre text not null,
  descripcion text,
  marca text,
  grupo text,
  familia text,
  modelo text,
  proveedor_id uuid references public.proveedores (id),
  stock_minimo numeric(12, 2),
  afectacion_impuesto text,
  tipo_impuesto text,
  cualidad text,
  control_inventario boolean not null default true,
  tipo_producto text not null default 'bien',
  lugar_elaboracion text,
  precio_venta numeric(12, 2) not null default 0,
  precio_venta_moneda text not null default 'PEN',
  costo_referencial numeric(12, 2),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.proveedores enable row level security;
alter table public.productos enable row level security;

create policy "proveedores: select por empresa" on public.proveedores
  for select using (empresa_id = public.current_empresa_id());
create policy "proveedores: insert por empresa" on public.proveedores
  for insert with check (empresa_id = public.current_empresa_id());
create policy "proveedores: update por empresa" on public.proveedores
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy "productos: select por empresa" on public.productos
  for select using (empresa_id = public.current_empresa_id());
create policy "productos: insert por empresa" on public.productos
  for insert with check (empresa_id = public.current_empresa_id());
create policy "productos: update por empresa" on public.productos
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

-- No delete policies: both are soft-deleted via `activo`.

grant select, insert, update on public.proveedores to authenticated;
grant select, insert, update on public.productos to authenticated;

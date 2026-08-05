-- Módulo de compras (post-MVP, análogo a ventas/cobranzas pero del lado
-- de comprar a proveedores). Flujo de un solo paso: registrar la compra
-- ya asume que la mercadería fue recibida, así que sube el stock de
-- inmediato (a diferencia de pedido→venta, que separa lo pedido de lo
-- entregado). pagos_proveedor espeja el patrón de cobranzas: nunca se
-- borra, se anula (estado) para conservar trazabilidad.

create table public.compras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  proveedor_id uuid not null references public.proveedores (id),
  fecha timestamptz not null default now(),
  moneda text not null default 'PEN',
  tipo_cambio_aplicado numeric(10, 4) not null default 1,
  total numeric(12, 2) not null default 0,
  estado text not null default 'registrada', -- 'registrada' | 'anulada'
  usuario_id uuid not null references public.usuarios (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compra_detalle (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad numeric(12, 2) not null,
  costo_unitario numeric(12, 2) not null,
  subtotal numeric(12, 2) not null
);

create table public.pagos_proveedor (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  compra_id uuid not null references public.compras (id),
  fecha timestamptz not null default now(),
  monto numeric(12, 2) not null,
  moneda text not null default 'PEN',
  tipo_cambio_aplicado numeric(10, 4) not null default 1,
  metodo_pago text not null default 'efectivo',
  referencia text,
  estado text not null default 'activa', -- 'activa' | 'anulada'
  usuario_id uuid not null references public.usuarios (id),
  created_at timestamptz not null default now()
);

alter table public.compras enable row level security;
alter table public.compra_detalle enable row level security;
alter table public.pagos_proveedor enable row level security;

create policy "compras: select por empresa" on public.compras
  for select using (empresa_id = public.current_empresa_id());
create policy "compras: insert por empresa" on public.compras
  for insert with check (empresa_id = public.current_empresa_id());
create policy "compras: update por empresa" on public.compras
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy "compra_detalle: select por empresa" on public.compra_detalle
  for select using (
    exists (
      select 1 from public.compras c
      where c.id = compra_detalle.compra_id
        and c.empresa_id = public.current_empresa_id()
    )
  );
create policy "compra_detalle: insert por empresa" on public.compra_detalle
  for insert with check (
    exists (
      select 1 from public.compras c
      where c.id = compra_detalle.compra_id
        and c.empresa_id = public.current_empresa_id()
    )
  );

create policy "pagos_proveedor: select por empresa" on public.pagos_proveedor
  for select using (empresa_id = public.current_empresa_id());
create policy "pagos_proveedor: insert por empresa" on public.pagos_proveedor
  for insert with check (empresa_id = public.current_empresa_id());
create policy "pagos_proveedor: update por empresa" on public.pagos_proveedor
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

grant select, insert, update on public.compras to authenticated;
grant select, insert on public.compra_detalle to authenticated;
grant select, insert, update on public.pagos_proveedor to authenticated;

create index if not exists idx_compras_empresa_id on public.compras (empresa_id);
create index if not exists idx_compras_proveedor_id on public.compras (proveedor_id);
create index if not exists idx_compra_detalle_compra_id on public.compra_detalle (compra_id);
create index if not exists idx_compra_detalle_producto_id on public.compra_detalle (producto_id);
create index if not exists idx_pagos_proveedor_empresa_id on public.pagos_proveedor (empresa_id);
create index if not exists idx_pagos_proveedor_compra_id on public.pagos_proveedor (compra_id);

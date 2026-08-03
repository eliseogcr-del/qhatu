-- Módulo 6 del plan: ventas (lo realmente entregado, distinto de
-- pedido_detalle que es lo pedido) y devoluciones. Las devoluciones
-- siempre se dan de baja como merma — no reingresan a stock — por eso
-- solo se registran, sin ningún camino de "reingreso" en el esquema.

create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  pedido_id uuid not null references public.pedidos (id),
  cliente_id uuid not null references public.clientes (id),
  fecha timestamptz not null default now(),
  moneda text not null default 'PEN',
  tipo_cambio_aplicado numeric(10, 4) not null default 1,
  total numeric(12, 2) not null default 0,
  estado text not null default 'registrada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.venta_detalle (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad numeric(12, 2) not null,
  cantidad_entregada numeric(12, 2) not null,
  precio_unitario numeric(12, 2) not null,
  subtotal numeric(12, 2) not null
);

create table public.devoluciones (
  id uuid primary key default gen_random_uuid(),
  venta_detalle_id uuid not null references public.venta_detalle (id) on delete cascade,
  cantidad numeric(12, 2) not null,
  motivo text,
  tipo text not null default 'otro',
  fecha timestamptz not null default now(),
  usuario_id uuid not null references public.usuarios (id)
);

alter table public.ventas enable row level security;
alter table public.venta_detalle enable row level security;
alter table public.devoluciones enable row level security;

create policy "ventas: select por empresa" on public.ventas
  for select using (empresa_id = public.current_empresa_id());
create policy "ventas: insert por empresa" on public.ventas
  for insert with check (empresa_id = public.current_empresa_id());
create policy "ventas: update por empresa" on public.ventas
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy "venta_detalle: select por empresa" on public.venta_detalle
  for select using (
    exists (
      select 1 from public.ventas v
      where v.id = venta_detalle.venta_id
        and v.empresa_id = public.current_empresa_id()
    )
  );
create policy "venta_detalle: insert por empresa" on public.venta_detalle
  for insert with check (
    exists (
      select 1 from public.ventas v
      where v.id = venta_detalle.venta_id
        and v.empresa_id = public.current_empresa_id()
    )
  );

create policy "devoluciones: select por empresa" on public.devoluciones
  for select using (
    exists (
      select 1 from public.venta_detalle vd
      join public.ventas v on v.id = vd.venta_id
      where vd.id = devoluciones.venta_detalle_id
        and v.empresa_id = public.current_empresa_id()
    )
  );
create policy "devoluciones: insert por empresa" on public.devoluciones
  for insert with check (
    exists (
      select 1 from public.venta_detalle vd
      join public.ventas v on v.id = vd.venta_id
      where vd.id = devoluciones.venta_detalle_id
        and v.empresa_id = public.current_empresa_id()
    )
  );

grant select, insert, update on public.ventas to authenticated;
grant select, insert on public.venta_detalle to authenticated;
grant select, insert on public.devoluciones to authenticated;

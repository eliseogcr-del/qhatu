-- Módulo 7 del plan: cobranzas. venta_id es nullable porque un anticipo
-- se registra contra el pedido_id desde el inicio, antes de que exista
-- la venta; se amarra a la venta específica cuando esta se genera (ver
-- createVenta en la app, que actualiza los anticipos sueltos del pedido).

create table public.cobranzas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  pedido_id uuid not null references public.pedidos (id),
  venta_id uuid references public.ventas (id),
  fecha timestamptz not null default now(),
  monto numeric(12, 2) not null,
  moneda text not null default 'PEN',
  tipo_cambio_aplicado numeric(10, 4) not null default 1,
  metodo_pago text not null default 'efectivo',
  tipo_pago text not null default 'anticipo',
  referencia text,
  usuario_id uuid not null references public.usuarios (id),
  created_at timestamptz not null default now()
);

alter table public.cobranzas enable row level security;

create policy "cobranzas: select por empresa" on public.cobranzas
  for select using (empresa_id = public.current_empresa_id());
create policy "cobranzas: insert por empresa" on public.cobranzas
  for insert with check (empresa_id = public.current_empresa_id());
create policy "cobranzas: update por empresa" on public.cobranzas
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

grant select, insert, update on public.cobranzas to authenticated;

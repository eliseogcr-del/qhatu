-- Módulo 5 del plan: reparto (asignación de transporte y estado de envío
-- por pedido). A diferencia de pedido_detalle/pedido_adjuntos, repartos es
-- una entidad de negocio de primer nivel, así que lleva empresa_id propio.

create table public.repartos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  pedido_id uuid not null references public.pedidos (id),
  fecha_reparto date,
  tipo_transporte text not null default 'repartidor_propio',
  transportista_nombre text,
  repartidor_id uuid references public.usuarios (id),
  estado text not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.repartos enable row level security;

create policy "repartos: select por empresa" on public.repartos
  for select using (empresa_id = public.current_empresa_id());
create policy "repartos: insert por empresa" on public.repartos
  for insert with check (empresa_id = public.current_empresa_id());
create policy "repartos: update por empresa" on public.repartos
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

grant select, insert, update on public.repartos to authenticated;

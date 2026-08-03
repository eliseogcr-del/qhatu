-- Módulo 4 del plan: pedidos, su detalle de líneas, y adjuntos (fotos de
-- WhatsApp, etc.). pedido_detalle/pedido_adjuntos no llevan empresa_id
-- propio (como cliente_vendedor) — se scope vía join a pedidos.

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  cliente_id uuid not null references public.clientes (id),
  canal_pedido text not null default 'telefono',
  fecha timestamptz not null default now(),
  fecha_entrega_requerida date,
  estado text not null default 'pendiente_confirmacion',
  moneda text not null default 'PEN',
  total numeric(12, 2) not null default 0,
  usuario_id uuid not null references public.usuarios (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pedido_detalle (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad numeric(12, 2) not null,
  precio_unitario numeric(12, 2) not null,
  subtotal numeric(12, 2) not null
);

create table public.pedido_adjuntos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  tipo_archivo text not null,
  url_archivo text not null,
  fecha timestamptz not null default now()
);

alter table public.pedidos enable row level security;
alter table public.pedido_detalle enable row level security;
alter table public.pedido_adjuntos enable row level security;

create policy "pedidos: select por empresa" on public.pedidos
  for select using (empresa_id = public.current_empresa_id());
create policy "pedidos: insert por empresa" on public.pedidos
  for insert with check (empresa_id = public.current_empresa_id());
create policy "pedidos: update por empresa" on public.pedidos
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

create policy "pedido_detalle: select por empresa" on public.pedido_detalle
  for select using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_detalle.pedido_id
        and p.empresa_id = public.current_empresa_id()
    )
  );
create policy "pedido_detalle: insert por empresa" on public.pedido_detalle
  for insert with check (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_detalle.pedido_id
        and p.empresa_id = public.current_empresa_id()
    )
  );

create policy "pedido_adjuntos: select por empresa" on public.pedido_adjuntos
  for select using (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_adjuntos.pedido_id
        and p.empresa_id = public.current_empresa_id()
    )
  );
create policy "pedido_adjuntos: insert por empresa" on public.pedido_adjuntos
  for insert with check (
    exists (
      select 1 from public.pedidos p
      where p.id = pedido_adjuntos.pedido_id
        and p.empresa_id = public.current_empresa_id()
    )
  );

grant select, insert, update on public.pedidos to authenticated;
grant select, insert on public.pedido_detalle to authenticated;
grant select, insert on public.pedido_adjuntos to authenticated;

-- Storage: bucket privado para adjuntos de pedidos (fotos de WhatsApp,
-- PDFs, etc.), con acceso restringido por carpeta = empresa_id.
insert into storage.buckets (id, name, public)
values ('pedido-adjuntos', 'pedido-adjuntos', false)
on conflict (id) do nothing;

create policy "pedido_adjuntos storage: select por empresa" on storage.objects
  for select using (
    bucket_id = 'pedido-adjuntos'
    and (storage.foldername(name)) [1] = public.current_empresa_id()::text
  );

create policy "pedido_adjuntos storage: insert por empresa" on storage.objects
  for insert with check (
    bucket_id = 'pedido-adjuntos'
    and (storage.foldername(name)) [1] = public.current_empresa_id()::text
  );

-- Canales conectados por tenant (WhatsApp/Instagram) y sus clientes finales.

create table public.tenant_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  canal text not null check (canal in ('whatsapp', 'instagram')),
  identificador_externo text not null, -- phone_number_id (WhatsApp) o page_id (Instagram)
  access_token text not null,
  creado_en timestamptz not null default now(),
  unique (canal, identificador_externo)
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  nombre text,
  telefono text,
  instagram_handle text,
  canal_preferido text check (canal_preferido in ('whatsapp', 'instagram')),
  creado_en timestamptz not null default now()
);

-- El webhook de Meta identifica el tenant a partir del phone_number_id/page_id
-- del payload entrante; este índice es lo que hace esa búsqueda rápida.
create index tenant_channels_identificador_idx
  on public.tenant_channels (identificador_externo);

create index clientes_tenant_idx on public.clientes (tenant_id);

alter table public.tenant_channels enable row level security;
alter table public.clientes enable row level security;

create policy "tenant_channels: select por tenant" on public.tenant_channels
  for select using (tenant_id = public.current_tenant_id());

create policy "tenant_channels: insert por tenant" on public.tenant_channels
  for insert with check (tenant_id = public.current_tenant_id());

create policy "tenant_channels: update por tenant" on public.tenant_channels
  for update using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "tenant_channels: delete por tenant" on public.tenant_channels
  for delete using (tenant_id = public.current_tenant_id());

create policy "clientes: select por tenant" on public.clientes
  for select using (tenant_id = public.current_tenant_id());

create policy "clientes: insert por tenant" on public.clientes
  for insert with check (tenant_id = public.current_tenant_id());

create policy "clientes: update por tenant" on public.clientes
  for update using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update, delete on public.tenant_channels to authenticated;
grant select, insert, update on public.clientes to authenticated;

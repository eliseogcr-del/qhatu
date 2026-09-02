-- Base multi-tenant schema: tenants + usuarios (perfil).
-- Every business table carries tenant_id from day one, even though the MVP
-- is only validated with a handful of pilot tenants.

create extension if not exists "pgcrypto";

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  plan text not null default 'piloto',
  creado_en timestamptz not null default now()
);

-- Profile row linked 1:1 to auth.users, carrying which tenant the user
-- belongs to and their role within it.
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id),
  nombre text,
  email text,
  rol text not null default 'agente',
  creado_en timestamptz not null default now()
);

-- Returns the tenant_id of the currently authenticated user.
-- security definer so it can read public.usuarios regardless of the caller's
-- own RLS grants, without causing recursive policy evaluation on usuarios.
create or replace function public.current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from public.usuarios where id = auth.uid()
$$;

alter table public.tenants enable row level security;
alter table public.usuarios enable row level security;

create policy "tenants: ver el propio" on public.tenants
  for select using (id = public.current_tenant_id());

create policy "usuarios: verse a si mismo" on public.usuarios
  for select using (id = auth.uid());

create policy "usuarios: ver colegas del tenant" on public.usuarios
  for select using (tenant_id = public.current_tenant_id());

grant usage on schema public to authenticated;
grant select on public.tenants to authenticated;
grant select on public.usuarios to authenticated;

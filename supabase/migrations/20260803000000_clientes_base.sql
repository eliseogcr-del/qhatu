-- Base multi-tenant schema: empresas, usuarios (perfil), clientes, cliente_vendedor.
-- Every business table carries empresa_id from day one, even with a single tenant today.

create extension if not exists "pgcrypto";

create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Profile row linked 1:1 to auth.users, carrying which empresa the user belongs to.
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id),
  nombre text,
  rol text not null default 'vendedor',
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  tipo_documento text not null,
  numero_documento text not null,
  nombre text not null,
  contacto text,
  correo_electronico text,
  telefono text,
  departamento text,
  provincia text,
  distrito text,
  direccion text,
  referencia text,
  latitud double precision,
  longitud double precision,
  zona text,
  giro_negocio text,
  grupo text,
  lista_precio_id uuid,
  linea_credito numeric(12, 2) not null default 0,
  codigo_interno text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, tipo_documento, numero_documento)
);

create table public.cliente_vendedor (
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  primary key (cliente_id, usuario_id)
);

-- Returns the empresa_id of the currently authenticated user.
-- security definer so it can read public.usuarios regardless of the caller's
-- own RLS grants, without causing recursive policy evaluation on usuarios.
create or replace function public.current_empresa_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select empresa_id from public.usuarios where id = auth.uid()
$$;

alter table public.empresas enable row level security;
alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.cliente_vendedor enable row level security;

create policy "empresas: ver la propia" on public.empresas
  for select using (id = public.current_empresa_id());

create policy "usuarios: verse a si mismo" on public.usuarios
  for select using (id = auth.uid());

create policy "usuarios: ver colegas de la empresa" on public.usuarios
  for select using (empresa_id = public.current_empresa_id());

create policy "clientes: select por empresa" on public.clientes
  for select using (empresa_id = public.current_empresa_id());

create policy "clientes: insert por empresa" on public.clientes
  for insert with check (empresa_id = public.current_empresa_id());

create policy "clientes: update por empresa" on public.clientes
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

-- No delete policy: clients are soft-deleted via the `activo` flag, never
-- hard-deleted, so history (pedidos, ventas, etc.) never dangles.

create policy "cliente_vendedor: select por empresa" on public.cliente_vendedor
  for select using (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_vendedor.cliente_id
        and c.empresa_id = public.current_empresa_id()
    )
  );

create policy "cliente_vendedor: insert por empresa" on public.cliente_vendedor
  for insert with check (
    exists (
      select 1 from public.clientes c
      where c.id = cliente_vendedor.cliente_id
        and c.empresa_id = public.current_empresa_id()
    )
  );

-- Seed: single tenant bootstrap. Rename the empresa later as needed.
insert into public.empresas (nombre) values ('Mi Empresa');

insert into public.usuarios (id, empresa_id, nombre, rol)
select u.id, e.id, u.email, 'admin'
from auth.users u
cross join (select id from public.empresas limit 1) e
where u.email = 'eliseogcr@gmail.com';

-- Metas de venta por período (mes) y por vendedor, para el nuevo reporte
-- "Objetivos" (/reportes/objetivos) — compara lo vendido en el mes contra
-- una meta cargada a mano, igual que el tablero en Excel que lo inspiró.
-- vendedor_id null = meta general de toda la empresa para ese mes (en el
-- Excel original no hay corte por vendedor, es una sola meta mensual).
--
-- vendedor_clave es una columna generada que reemplaza null por un uuid
-- fijo: un índice único parcial (WHERE vendedor_id IS NULL) no sirve como
-- objetivo de un upsert por lista de columnas (lo que usa supabase-js),
-- así que se arma un índice único normal sobre las 3 columnas en su lugar.

create table public.metas_ventas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  periodo date not null,
  vendedor_id uuid references public.usuarios (id),
  vendedor_clave uuid generated always as (
    coalesce(vendedor_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored,
  monto numeric(12, 2) not null check (monto >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint metas_ventas_periodo_primer_dia check (extract(day from periodo) = 1)
);

create unique index idx_metas_ventas_empresa_periodo_vendedor
  on public.metas_ventas (empresa_id, periodo, vendedor_clave);

create index idx_metas_ventas_empresa_periodo
  on public.metas_ventas (empresa_id, periodo);

alter table public.metas_ventas enable row level security;

-- Solo admin gestiona y ve metas — Reportes (donde vive este reporte) ya
-- es una sección exclusiva de administrador en la barra lateral.
create policy "metas_ventas: select solo admin" on public.metas_ventas
  for select using (empresa_id = public.current_empresa_id() and public.es_admin());

create policy "metas_ventas: insert solo admin" on public.metas_ventas
  for insert with check (empresa_id = public.current_empresa_id() and public.es_admin());

create policy "metas_ventas: update solo admin" on public.metas_ventas
  for update using (empresa_id = public.current_empresa_id() and public.es_admin())
  with check (empresa_id = public.current_empresa_id());

create policy "metas_ventas: delete solo admin" on public.metas_ventas
  for delete using (empresa_id = public.current_empresa_id() and public.es_admin());

grant select, insert, update, delete on public.metas_ventas to authenticated;

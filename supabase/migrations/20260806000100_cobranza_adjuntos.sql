-- Evidencia de pago (foto del Yape/Plin/etc.) adjunta a una cobranza.
-- Mismo patrón que pedido_adjuntos (bucket privado + RLS por carpeta de
-- empresa), con dos agregados pensados para el plan free de Supabase
-- (1GB de storage total, compartido entre pedido-adjuntos y
-- cobranza-adjuntos):
--   1. tamano_bytes, para poder medir cuánto se está usando sin depender
--      de leer storage.objects en cada request.
--   2. ruta_local/archivado_en/archivado_por: cuando el admin descarga y
--      libera espacio, el archivo se borra de Storage pero la fila queda
--      (no se borra) con la ruta local donde quedó archivado — nunca se
--      pierde el rastro de que existió un comprobante, aunque el archivo
--      ya no esté en la nube.

create table public.cobranza_adjuntos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  cobranza_id uuid not null references public.cobranzas (id) on delete cascade,
  nombre_archivo text not null,
  storage_path text,
  tamano_bytes bigint not null default 0,
  ruta_local text,
  archivado_en timestamptz,
  archivado_por uuid references public.usuarios (id),
  created_at timestamptz not null default now()
);

alter table public.cobranza_adjuntos enable row level security;

create policy "cobranza_adjuntos: select por empresa" on public.cobranza_adjuntos
  for select using (empresa_id = public.current_empresa_id());
create policy "cobranza_adjuntos: insert por empresa" on public.cobranza_adjuntos
  for insert with check (empresa_id = public.current_empresa_id());
create policy "cobranza_adjuntos: update por empresa" on public.cobranza_adjuntos
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

grant select, insert, update on public.cobranza_adjuntos to authenticated;

create index if not exists idx_cobranza_adjuntos_empresa_id on public.cobranza_adjuntos (empresa_id);
create index if not exists idx_cobranza_adjuntos_cobranza_id on public.cobranza_adjuntos (cobranza_id);

insert into storage.buckets (id, name, public)
values ('cobranza-adjuntos', 'cobranza-adjuntos', false)
on conflict (id) do nothing;

create policy "cobranza_adjuntos storage: select por empresa" on storage.objects
  for select using (
    bucket_id = 'cobranza-adjuntos'
    and (storage.foldername(name)) [1] = public.current_empresa_id()::text
  );

create policy "cobranza_adjuntos storage: insert por empresa" on storage.objects
  for insert with check (
    bucket_id = 'cobranza-adjuntos'
    and (storage.foldername(name)) [1] = public.current_empresa_id()::text
  );

create policy "cobranza_adjuntos storage: delete por empresa" on storage.objects
  for delete using (
    bucket_id = 'cobranza-adjuntos'
    and (storage.foldername(name)) [1] = public.current_empresa_id()::text
  );

-- Suma el tamaño de todo lo que hay en Storage para la empresa actual,
-- entre pedido-adjuntos y cobranza-adjuntos (comparten el mismo tope de
-- 1GB del plan free) — evita mantener un contador propio que se pueda
-- desincronizar del storage real.
create or replace function public.total_storage_usado_bytes()
returns bigint
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)
  from storage.objects
  where bucket_id in ('pedido-adjuntos', 'cobranza-adjuntos')
    and (storage.foldername(name))[1] = public.current_empresa_id()::text
$$;

grant execute on function public.total_storage_usado_bytes() to authenticated;

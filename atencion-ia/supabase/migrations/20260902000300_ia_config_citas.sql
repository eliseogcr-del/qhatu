-- Configuración de IA por tenant (prompt, tono, reglas de escalamiento) y
-- citas agendadas vía Google Calendar.

create table public.tenant_ia_config (
  tenant_id uuid primary key references public.tenants (id),
  prompt_sistema text not null default '',
  reglas_escalamiento text not null default '',
  actualizado_en timestamptz not null default now()
);

create table public.citas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  conversacion_id uuid not null references public.conversaciones (id),
  fecha_hora timestamptz not null,
  estado text not null default 'agendada' check (
    estado in ('agendada', 'reprogramada', 'cancelada')
  ),
  google_calendar_event_id text,
  creado_en timestamptz not null default now()
);

create index citas_tenant_idx on public.citas (tenant_id, fecha_hora);

alter table public.tenant_ia_config enable row level security;
alter table public.citas enable row level security;

create policy "tenant_ia_config: select por tenant" on public.tenant_ia_config
  for select using (tenant_id = public.current_tenant_id());

create policy "tenant_ia_config: insert por tenant" on public.tenant_ia_config
  for insert with check (tenant_id = public.current_tenant_id());

create policy "tenant_ia_config: update por tenant" on public.tenant_ia_config
  for update using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "citas: select por tenant" on public.citas
  for select using (tenant_id = public.current_tenant_id());

create policy "citas: insert por tenant" on public.citas
  for insert with check (tenant_id = public.current_tenant_id());

create policy "citas: update por tenant" on public.citas
  for update using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

grant select, insert, update on public.tenant_ia_config to authenticated;
grant select, insert, update on public.citas to authenticated;

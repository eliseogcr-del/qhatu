-- Conversaciones (una por cliente+canal activo) y sus mensajes.

create table public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id),
  cliente_id uuid not null references public.clientes (id),
  canal text not null check (canal in ('whatsapp', 'instagram')),
  estado text not null default 'nuevo' check (
    estado in ('nuevo', 'en_conversacion', 'cotizado', 'cerrado', 'reprogramado')
  ),
  -- Quién atiende la conversación ahora mismo: null = la IA; un usuario
  -- cuando se escaló a un agente humano.
  asignado_a_usuario_id uuid references public.usuarios (id),
  requiere_humano boolean not null default false,
  actualizado_en timestamptz not null default now()
);

create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
  remitente text not null check (remitente in ('cliente', 'ia', 'agente')),
  contenido text not null,
  enviado_en timestamptz not null default now(),
  -- Ej: {"intencion": "consulta_precio", "confianza": 0.82}
  metadata_ia jsonb
);

create index conversaciones_tenant_idx on public.conversaciones (tenant_id, actualizado_en desc);
create index mensajes_conversacion_idx on public.mensajes (conversacion_id, enviado_en);

alter table public.conversaciones enable row level security;
alter table public.mensajes enable row level security;

create policy "conversaciones: select por tenant" on public.conversaciones
  for select using (tenant_id = public.current_tenant_id());

create policy "conversaciones: insert por tenant" on public.conversaciones
  for insert with check (tenant_id = public.current_tenant_id());

create policy "conversaciones: update por tenant" on public.conversaciones
  for update using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

create policy "mensajes: select por tenant" on public.mensajes
  for select using (
    exists (
      select 1 from public.conversaciones c
      where c.id = mensajes.conversacion_id
        and c.tenant_id = public.current_tenant_id()
    )
  );

create policy "mensajes: insert por tenant" on public.mensajes
  for insert with check (
    exists (
      select 1 from public.conversaciones c
      where c.id = mensajes.conversacion_id
        and c.tenant_id = public.current_tenant_id()
    )
  );

grant select, insert, update on public.conversaciones to authenticated;
grant select, insert on public.mensajes to authenticated;

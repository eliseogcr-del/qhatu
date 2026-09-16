-- Guía de Remisión Remitente Electrónica (GRE), vía Nubefact. Se emite
-- desde un reparto (Grimana Food es quien traslada su propia mercadería
-- vendida, nunca un transportista de terceros, así que solo se soporta
-- el tipo "Remitente" — código 7 de Nubefact). El campo tipo_de_transporte
-- que exige Nubefact (01 público / 02 privado) se deriva del
-- tipo_transporte que ya tiene el reparto: repartidor_propio y
-- vehiculo_cliente son transporte privado (piden datos del conductor,
-- que ya viven en usuarios); delivery_subcontratado es transporte
-- público (pide RUC/razón social de la empresa transportista).

alter table public.repartos
  add column placa_numero text,
  add column peso_bruto_total numeric(12, 2),
  add column numero_de_bultos integer,
  add column transportista_ruc text;

create table public.guias_remision (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  reparto_id uuid not null references public.repartos (id),
  tipo_comprobante integer not null default 7,
  serie text not null,
  numero integer not null,
  estado text not null default 'pendiente', -- pendiente | aceptada | rechazada | error
  aceptado_por_sunat boolean,
  sunat_description text,
  enlace_pdf text,
  enlace_xml text,
  enlace_cdr text,
  error_mensaje text,
  fecha_emision timestamptz not null default now(),
  usuario_id uuid not null references public.usuarios (id),
  created_at timestamptz not null default now(),
  unique (reparto_id)
);

alter table public.guias_remision enable row level security;

create policy "guias_remision: select por empresa" on public.guias_remision
  for select using (empresa_id = public.current_empresa_id());
create policy "guias_remision: insert por empresa" on public.guias_remision
  for insert with check (empresa_id = public.current_empresa_id());
create policy "guias_remision: update por empresa" on public.guias_remision
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

grant select, insert, update on public.guias_remision to authenticated;

create index if not exists idx_guias_remision_empresa_id on public.guias_remision (empresa_id);
create index if not exists idx_guias_remision_reparto_id on public.guias_remision (reparto_id);

alter table public.configuracion_facturacion
  add column serie_guia_remision text not null default 'TTT1';

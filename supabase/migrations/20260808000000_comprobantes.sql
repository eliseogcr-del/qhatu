-- Facturación electrónica (Nubefact). Una venta puede tener un
-- comprobante (factura o boleta) emitido a través de un proveedor
-- externo (OSE/PSE) — nosotros solo guardamos la referencia y los
-- enlaces al PDF/XML/CDR que Nubefact devuelve, no generamos ni
-- firmamos nada nosotros mismos.
create table public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  venta_id uuid not null references public.ventas (id),
  tipo_comprobante integer not null, -- 1=Factura, 2=Boleta (códigos Nubefact/SUNAT)
  serie text not null,
  numero integer not null,
  estado text not null default 'pendiente', -- pendiente | emitido | error | anulado
  aceptado_por_sunat boolean,
  sunat_description text,
  enlace text,
  enlace_pdf text,
  enlace_xml text,
  enlace_cdr text,
  error_mensaje text,
  fecha_emision timestamptz not null default now(),
  usuario_id uuid not null references public.usuarios (id),
  created_at timestamptz not null default now()
);

alter table public.comprobantes enable row level security;

create policy "comprobantes: select por empresa" on public.comprobantes
  for select using (empresa_id = public.current_empresa_id());
create policy "comprobantes: insert por empresa" on public.comprobantes
  for insert with check (empresa_id = public.current_empresa_id());
create policy "comprobantes: update por empresa" on public.comprobantes
  for update using (empresa_id = public.current_empresa_id())
  with check (empresa_id = public.current_empresa_id());

grant select, insert, update on public.comprobantes to authenticated;

create index if not exists idx_comprobantes_empresa_id on public.comprobantes (empresa_id);
create index if not exists idx_comprobantes_venta_id on public.comprobantes (venta_id);

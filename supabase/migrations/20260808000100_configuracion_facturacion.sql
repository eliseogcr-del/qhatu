-- Series de Nubefact configurables desde Administración, en vez de estar
-- fijas en el código — el día que la empresa pase de la cuenta demo a
-- producción, solo cambian estos dos valores en pantalla.
-- Una fila por empresa (empresa_id es la PK).
create table public.configuracion_facturacion (
  empresa_id uuid primary key references public.empresas (id),
  serie_factura text not null default 'FFF1',
  serie_boleta text not null default 'BBB1',
  updated_at timestamptz not null default now()
);

alter table public.configuracion_facturacion enable row level security;

-- Cualquier usuario de la empresa puede leerla (la necesita emitirComprobante,
-- que no está restringido a admin), pero solo un admin puede modificarla.
create policy "configuracion_facturacion: select por empresa" on public.configuracion_facturacion
  for select using (empresa_id = public.current_empresa_id());

create policy "configuracion_facturacion: insert solo admin" on public.configuracion_facturacion
  for insert with check (
    empresa_id = public.current_empresa_id()
    and exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  );

create policy "configuracion_facturacion: update solo admin" on public.configuracion_facturacion
  for update using (
    empresa_id = public.current_empresa_id()
    and exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.rol = 'admin'
    )
  )
  with check (empresa_id = public.current_empresa_id());

grant select, insert, update on public.configuracion_facturacion to authenticated;

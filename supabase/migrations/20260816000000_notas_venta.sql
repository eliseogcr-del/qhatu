-- Nota de venta: documento interno de venta (NO pasa por Nubefact/SUNAT,
-- no tiene XML ni código QR) que se imprime con un formato similar al de
-- una boleta, para clientes/ventas que no requieren comprobante fiscal.
-- Reutiliza la tabla `comprobantes` existente con tipo_comprobante = 9
-- (fuera del catálogo SUNAT 1-4 que ya usan Factura/Boleta/NC/ND), así
-- reaprovecha RLS, el listado de /comprobantes y el ciclo de vida ya
-- existentes en vez de crear una tabla paralela.

-- A diferencia de factura/boleta (una sola serie por empresa, en
-- configuracion_facturacion), la numeración de nota de venta se pide
-- diferenciada POR ALMACÉN — se guarda directamente en comprobantes para
-- poder filtrar el siguiente número sin un join a ventas.
alter table public.comprobantes
  add column almacen_id uuid references public.almacenes (id);

create index if not exists idx_comprobantes_almacen_id on public.comprobantes (almacen_id);

create table public.series_nota_venta (
  almacen_id uuid primary key references public.almacenes (id),
  serie text not null default 'NV01',
  updated_at timestamptz not null default now()
);

alter table public.series_nota_venta enable row level security;

create policy "series_nota_venta: select por empresa" on public.series_nota_venta
  for select using (
    exists (
      select 1 from public.almacenes a
      where a.id = series_nota_venta.almacen_id
        and a.empresa_id = public.current_empresa_id()
    )
  );

create policy "series_nota_venta: insert admin" on public.series_nota_venta
  for insert with check (
    public.es_admin()
    and exists (
      select 1 from public.almacenes a
      where a.id = series_nota_venta.almacen_id
        and a.empresa_id = public.current_empresa_id()
    )
  );

create policy "series_nota_venta: update admin" on public.series_nota_venta
  for update using (
    public.es_admin()
    and exists (
      select 1 from public.almacenes a
      where a.id = series_nota_venta.almacen_id
        and a.empresa_id = public.current_empresa_id()
    )
  )
  with check (
    public.es_admin()
    and exists (
      select 1 from public.almacenes a
      where a.id = series_nota_venta.almacen_id
        and a.empresa_id = public.current_empresa_id()
    )
  );

grant select, insert, update on public.series_nota_venta to authenticated;

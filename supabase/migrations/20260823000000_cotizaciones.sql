-- Cotizaciones: documento comercial pre-venta (sin cobro, sin impacto en
-- stock/kardex) que más adelante puede convertirse en un Pedido real.
-- A diferencia de todo lo demás en el sistema, admite un cliente NO
-- registrado ("prospecto") con datos escritos a mano — en campo el
-- vendedor cotiza antes de que el prospecto sea cliente.
--
-- El IGV de cotización es configurable (por defecto 10.5%, distinto del
-- 18% fijo que usa Nota de Venta/Factura/Boleta vía construirItemsYTotales
-- — ese valor NO se toca) y cada cotización guarda el porcentaje vigente
-- al crearse, para que un cambio posterior en la configuración no altere
-- cotizaciones ya emitidas. A diferencia del modelo de venta (donde el
-- precio unitario ya incluye el IGV), en la cotización el precio unitario
-- es SIN impuesto y el IGV se suma encima (Subtotal + Impuestos = Total).

create or replace function public.puede_ver_comercial()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select rol in ('admin', 'logistica', 'vendedor') from public.usuarios where id = auth.uid()),
    false
  )
$$;

create table public.configuracion_cotizaciones (
  empresa_id uuid primary key references public.empresas (id),
  numero_inicial integer not null default 1,
  porcentaje_igv numeric(5, 2) not null default 10.5,
  updated_at timestamptz not null default now()
);

alter table public.configuracion_cotizaciones enable row level security;

create policy "configuracion_cotizaciones: select por empresa" on public.configuracion_cotizaciones
  for select using (empresa_id = public.current_empresa_id());

create policy "configuracion_cotizaciones: insert solo admin" on public.configuracion_cotizaciones
  for insert with check (empresa_id = public.current_empresa_id() and public.es_admin());

create policy "configuracion_cotizaciones: update solo admin" on public.configuracion_cotizaciones
  for update using (empresa_id = public.current_empresa_id() and public.es_admin())
  with check (empresa_id = public.current_empresa_id());

grant select, insert, update on public.configuracion_cotizaciones to authenticated;

create table public.cotizaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  numero integer not null,
  fecha timestamptz not null default now(),
  usuario_id uuid not null references public.usuarios (id),
  cliente_id uuid references public.clientes (id),
  prospecto_nombre text,
  prospecto_ruc text,
  prospecto_telefono text,
  prospecto_correo text,
  moneda text not null default 'PEN',
  condiciones_comerciales text,
  porcentaje_igv numeric(5, 2) not null,
  subtotal numeric(12, 2) not null default 0,
  igv numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  pedido_id uuid references public.pedidos (id),
  created_at timestamptz not null default now(),
  constraint cotizaciones_cliente_o_prospecto check (
    cliente_id is not null or prospecto_nombre is not null
  )
);

create unique index idx_cotizaciones_empresa_numero on public.cotizaciones (empresa_id, numero);
create index idx_cotizaciones_empresa_id on public.cotizaciones (empresa_id);
create index idx_cotizaciones_cliente_id on public.cotizaciones (cliente_id);

create table public.cotizacion_detalle (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null references public.cotizaciones (id) on delete cascade,
  producto_id uuid not null references public.productos (id),
  cantidad numeric(12, 2) not null check (cantidad > 0),
  unidad_medida_id uuid references public.unidades_medida (id),
  precio_unitario numeric(12, 2) not null,
  subtotal numeric(12, 2) not null
);

create index idx_cotizacion_detalle_cotizacion_id on public.cotizacion_detalle (cotizacion_id);

alter table public.cotizaciones enable row level security;
alter table public.cotizacion_detalle enable row level security;

create policy "cotizaciones: select" on public.cotizaciones
  for select using (empresa_id = public.current_empresa_id() and public.puede_ver_comercial());

create policy "cotizaciones: insert" on public.cotizaciones
  for insert with check (empresa_id = public.current_empresa_id() and public.puede_ver_comercial());

-- Update solo se usa para fijar pedido_id al convertir en pedido (ver
-- enviarAPedido en cotizaciones/actions.ts) — igual que el resto del
-- sistema, la restricción de "qué columna" se confía a la capa de
-- aplicación, no a RLS por columna.
create policy "cotizaciones: update" on public.cotizaciones
  for update using (empresa_id = public.current_empresa_id() and public.puede_ver_comercial())
  with check (empresa_id = public.current_empresa_id());

create policy "cotizacion_detalle: select" on public.cotizacion_detalle
  for select using (
    exists (
      select 1 from public.cotizaciones c
      where c.id = cotizacion_detalle.cotizacion_id
        and c.empresa_id = public.current_empresa_id()
        and public.puede_ver_comercial()
    )
  );

create policy "cotizacion_detalle: insert" on public.cotizacion_detalle
  for insert with check (
    exists (
      select 1 from public.cotizaciones c
      where c.id = cotizacion_detalle.cotizacion_id
        and c.empresa_id = public.current_empresa_id()
        and public.puede_ver_comercial()
    )
  );

grant select, insert, update on public.cotizaciones to authenticated;
grant select, insert on public.cotizacion_detalle to authenticated;

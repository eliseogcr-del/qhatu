-- Comprobantes libres: factura/boleta emitida de forma independiente de
-- una venta (anticipos, y su regularización por saldo), pedido por el
-- contador. Reutiliza toda la infraestructura de "comprobantes" que ya
-- habla con Nubefact (numeración por serie, estados, enlaces al PDF/XML)
-- en vez de crear un camino paralelo — solo se le quita la obligación de
-- estar atado a una venta desde el momento en que se crea.
--
-- venta_id pasa a ser opcional: un comprobante libre nace sin venta y se
-- "asocia" después (un simple UPDATE de venta_id una vez existe la venta
-- real) — la asociación es solo una referencia de trazabilidad, el monto
-- del comprobante nunca tiene por qué cuadrar con el total de esa venta.
--
-- cliente_id es nuevo porque hoy el cliente de un comprobante se conoce
-- siempre a través de la venta (venta.cliente_id) — un comprobante libre
-- no tiene venta todavía, así que necesita su propio cliente_id directo.
--
-- tipo_emision + comprobante_anticipo_id modelan el caso puntual que pidió
-- el contador: "Factura Anticipo" (se factura lo cobrado) y "Factura
-- Saldo" (se factura el total de nuevo, restando como línea de descuento
-- lo ya facturado en el anticipo) — comprobante_anticipo_id en el Saldo
-- apunta al comprobante del Anticipo que regulariza, para poder traer su
-- monto al armar esa línea de descuento.

alter table public.comprobantes
  alter column venta_id drop not null;

alter table public.comprobantes
  add column cliente_id uuid references public.clientes (id),
  add column origen text not null default 'venta',
  add column tipo_emision text,
  add column comprobante_anticipo_id uuid references public.comprobantes (id),
  add column descripcion text;

alter table public.comprobantes
  add constraint comprobantes_origen_check check (origen in ('venta', 'libre'));

alter table public.comprobantes
  add constraint comprobantes_tipo_emision_check
  check (tipo_emision is null or tipo_emision in ('anticipo', 'saldo'));

-- Un comprobante de venta sigue resolviendo su cliente a través de la
-- venta (como siempre) — solo el libre está obligado a traer el suyo
-- propio, porque no tiene venta de la cual sacarlo.
alter table public.comprobantes
  add constraint comprobantes_libre_requiere_cliente
  check (origen = 'venta' or cliente_id is not null);

create index if not exists idx_comprobantes_cliente_id on public.comprobantes (cliente_id);
create index if not exists idx_comprobantes_comprobante_anticipo_id
  on public.comprobantes (comprobante_anticipo_id);

-- Líneas de producto/concepto de un comprobante libre, escritas a mano
-- (cantidad, descripción, precio unitario) — a diferencia de un
-- comprobante de venta, que arma sus líneas desde venta_detalle, estas no
-- dependen de ningún catálogo de precios ni mueven kardex/logística.
create table public.comprobante_libre_detalle (
  id uuid primary key default gen_random_uuid(),
  comprobante_id uuid not null references public.comprobantes (id) on delete cascade,
  producto_id uuid references public.productos (id),
  descripcion text not null,
  cantidad numeric(12, 2) not null check (cantidad > 0),
  precio_unitario numeric(12, 2) not null,
  subtotal numeric(12, 2) not null
);

create index if not exists idx_comprobante_libre_detalle_comprobante_id
  on public.comprobante_libre_detalle (comprobante_id);

alter table public.comprobante_libre_detalle enable row level security;

-- Sin empresa_id propio — la empresa se resuelve siempre a través del
-- comprobante dueño de la línea, igual que venta_detalle con ventas.
create policy "comprobante_libre_detalle: select por empresa" on public.comprobante_libre_detalle
  for select using (
    exists (
      select 1 from public.comprobantes c
      where c.id = comprobante_libre_detalle.comprobante_id
        and c.empresa_id = public.current_empresa_id()
    )
  );

create policy "comprobante_libre_detalle: insert por empresa" on public.comprobante_libre_detalle
  for insert with check (
    exists (
      select 1 from public.comprobantes c
      where c.id = comprobante_libre_detalle.comprobante_id
        and c.empresa_id = public.current_empresa_id()
    )
  );

grant select, insert on public.comprobante_libre_detalle to authenticated;

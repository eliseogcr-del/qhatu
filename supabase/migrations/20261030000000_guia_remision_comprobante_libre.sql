-- Permite emitir la guía de remisión directamente desde un comprobante
-- libre (factura/boleta sin venta/pedido detrás), no solo desde un
-- reparto — el contador pidió poder declarar el traslado de mercadería
-- de un anticipo/saldo sin tener que pasar por el módulo de Repartos.
--
-- guias_remision pasa a ser "de reparto" O "de comprobante libre", nunca
-- ambas — reparto_id se vuelve opcional, se agrega comprobante_id
-- (también único, mismo criterio que reparto_id) y un check que exige
-- exactamente uno de los dos. Los datos de transporte (placa, peso,
-- bultos, tipo de transporte, conductor/transportista) para un reparto
-- ya viven en la tabla `repartos` — un comprobante libre no tiene ese
-- equivalente, así que esta tabla pasa a guardarlos directamente para
-- ese caso (quedan NULL en las guías de reparto, que los siguen leyendo
-- de `repartos`).

alter table public.guias_remision
  alter column reparto_id drop not null;

alter table public.guias_remision
  add column comprobante_id uuid references public.comprobantes (id),
  add column almacen_id uuid references public.almacenes (id),
  add column placa_numero text,
  add column peso_bruto_total numeric(10, 2),
  add column numero_de_bultos integer,
  add column tipo_transporte text,
  add column transportista_nombre text,
  add column transportista_ruc text,
  add column repartidor_id uuid references public.usuarios (id),
  -- Opcional: cuando la guía de un comprobante libre se vincula a un
  -- pedido real del cliente (en vez de completar todo a mano), los items
  -- y el almacén de origen salen de ese pedido — se guarda la referencia
  -- acá solo para trazabilidad, nada depende de leerla después.
  add column pedido_id uuid references public.pedidos (id);

alter table public.guias_remision
  add constraint guias_remision_comprobante_id_key unique (comprobante_id);

alter table public.guias_remision
  add constraint guias_remision_origen_check
  check ((reparto_id is not null) <> (comprobante_id is not null));

create index if not exists idx_guias_remision_comprobante_id
  on public.guias_remision (comprobante_id);

-- Incidente evitado antes de que pase: la numeración de guía (igual que
-- comprobantes/nota de venta/cotizaciones antes de corregirlas) se
-- resolvía con "select max(numero) ... y súmale 1" desde el cliente —
-- con reparto Y comprobante libre compartiendo ahora la misma serie de
-- guía, el riesgo de carrera es mayor, no menor. Se reutiliza el mismo
-- contador atómico ya probado (comprobantes_correlativos +
-- siguiente_numero_comprobante) con tipo_comprobante = 7 — no choca con
-- ningún tipo ya usado (1, 2, 3, 4, 9) y la función no tiene ninguna
-- restricción que limite los valores aceptados.
insert into public.comprobantes_correlativos (empresa_id, tipo_comprobante, serie, ultimo_numero)
select empresa_id, 7, serie, max(numero)
from public.guias_remision
group by empresa_id, serie
on conflict (empresa_id, tipo_comprobante, serie, almacen_id) do nothing;

-- Complemento a stock_minimo: permite marcar un tope de stock por producto
-- (útil para detectar sobre-stock, no solo quiebre de stock).

alter table public.productos
  add column stock_maximo numeric(12, 2);

-- Motivo opcional para un movimiento de kardex — usado cuando se reduce
-- la cantidad entregada de una venta por debajo de lo que decía el
-- pedido original: el producto vuelve a stock (no es merma, se puede
-- volver a vender), pero queda registrado por qué el cliente no se lo
-- llevó completo.
alter table public.kardex_movimientos add column if not exists detalle text;

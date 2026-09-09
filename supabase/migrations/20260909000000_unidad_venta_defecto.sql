-- unidad_medida_id sigue siendo la unidad base del producto: la que usa
-- resolverPrecios() para saber por cuánto está denominado Precio
-- Campo/Digital, y la que se muestra en Inventario/Kardex. No debe
-- cambiar salvo que realmente cambie la unidad en que se compra/almacena
-- el producto.
--
-- unidad_venta_defecto_id es solo un atajo de UX: la unidad que se
-- preselecciona al agregar el producto en Pedidos, Ventas y Cotizaciones,
-- para ahorrar clics cuando casi siempre se vende en una unidad distinta
-- a la de almacenamiento (ej. CREMA VOLTEADA se guarda por UNIDAD pero se
-- vende casi siempre por 1/2 DOCENA). Si es null, se sigue usando
-- unidad_medida_id como antes. No participa en el cálculo de precios.
alter table public.productos
  add column unidad_venta_defecto_id uuid references public.unidades_medida (id);

-- admin y logística no tienen un almacén fijo (operan/ven todos), pero
-- pantallas sin selector propio (ej. Venta rápida) necesitan igual un
-- almacén al que asignar la venta. Sin esto, si el usuario nunca elige uno
-- a mano en una pantalla que sí tiene selector (ej. Venta directa), el
-- select arranca vacío y queda a criterio de quien registra la venta —
-- y si se equivoca, la venta queda mal clasificada bajo el almacén que
-- tocó sin querer, sin que nadie lo note (fue lo que pasó con la venta de
-- Logística: no había ningún valor por defecto que la guiara a elegir su
-- propio almacén).
--
-- Este campo es un DEFECTO/sugerencia, no una amarra: a diferencia de
-- almacen_id (que si está seteado, resolverAlmacenId lo usa siempre e
-- ignora el formulario — ver session.ts), almacen_origen_id solo se usa
-- para preseleccionar el select en pantallas con selector, y como último
-- recurso en pantallas sin selector (Venta rápida). Admin/logística
-- siguen pudiendo elegir cualquier otro almacén cuando el formulario se
-- lo permite.
alter table public.usuarios
  add column if not exists almacen_origen_id uuid references public.almacenes (id);

-- Por defecto, "Almacén principal" para todo admin/logística que no tenga
-- ya uno asignado — corrige de una vez a todos los usuarios existentes en
-- esta situación, no solo al que causó el problema.
update public.usuarios u
set almacen_origen_id = a.id
from public.almacenes a
where u.rol in ('admin', 'logistica')
  and u.almacen_origen_id is null
  and a.empresa_id = u.empresa_id
  and lower(trim(a.nombre)) = 'almacén principal';

-- Al guardar un comprobante libre de tipo "Saldo", además de las líneas
-- reales que el usuario escribe, se guarda una línea más: el descuento
-- del anticipo que se está regularizando (ver guardarDetalleLibre en
-- comprobantes-libres/actions.ts) — así el detalle muestra de dónde sale
-- el total a pagar. El problema: si ese primer intento de emisión falla
-- en SUNAT (queda en "error"), la pantalla de Editar vuelve a cargar
-- TODAS las líneas guardadas, incluida esa línea automática, y se la
-- muestra al usuario como si fuera una línea normal editable. Si la deja
-- ahí y reintenta, el descuento del anticipo se aplica dos veces (una
-- por la línea, otra por el cálculo de cabecera) y el total sale mal.
--
-- Se agrega una marca explícita para poder excluirla al armar el
-- formulario de edición, sin depender de adivinar por el texto de la
-- descripción.

alter table public.comprobante_libre_detalle
  add column es_descuento_anticipo boolean not null default false;

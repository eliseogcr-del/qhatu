-- Para declarar al conductor en una guía de remisión remitente con
-- transporte privado (repartidor propio) Nubefact exige DNI, nombre,
-- apellidos y número de licencia — se guardan una sola vez en el perfil
-- del repartidor en vez de pedirlos en cada reparto.

alter table public.usuarios
  add column dni text,
  add column apellidos text,
  add column licencia_conducir text;

-- Agrega soporte para precios creados por listero en la tabla precio
-- Requiere extensión pgcrypto para gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.precio
ADD COLUMN IF NOT EXISTS id_listero uuid;

-- Índices para filtrar por listero o banco
CREATE INDEX IF NOT EXISTS ix_precio_id_listero ON public.precio(id_listero);
CREATE INDEX IF NOT EXISTS ix_precio_id_banco ON public.precio(id_banco);

-- Restricción opcional: cada listero puede crear múltiples precios por lotería y nombre
-- (ajusta si deseas unicidad distinta)
CREATE UNIQUE INDEX IF NOT EXISTS ux_precio_listero_loteria_nombre
  ON public.precio(id_listero, id_loteria, lower(nombre))
  WHERE id_listero IS NOT NULL;

-- Nota: perfiles.id_precio puede apuntar a un precio del banco (id_listero NULL)
-- o a un precio creado por el listero (id_listero = listero propietario).

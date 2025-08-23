-- Skeleton SQL/CTE para estadísticas del listero usando sólo las tablas indicadas
-- Parámetros: :listero, :from, :to

WITH res_ranked AS (
  SELECT r.id_horario,
         (r.created_at::date) AS day,
         r.numeros AS resultado_numeros,
         r.created_at,
         ROW_NUMBER() OVER (PARTITION BY r.id_horario, r.created_at::date ORDER BY r.created_at DESC) AS rn
  FROM resultado r
  WHERE r.created_at::date BETWEEN :from AND :to
), res AS (
  SELECT id_horario, day, resultado_numeros
  FROM res_ranked
  WHERE rn = 1
), j AS (
  SELECT jg.id,
         jg.id_listero,
         jg.id_horario,
         jg.numeros,
         jg.monto_unitario,
         jg.monto_total,
         (jg.created_at::date) AS day,
         COALESCE(jg.monto_total, jg.monto_unitario * NULLIF(array_length(string_to_array(trim(jg.numeros), ' '),1),0)) AS monto_recogido_inferido
  FROM jugada jg
  WHERE jg.id_listero = :listero
    AND jg.created_at::date BETWEEN :from AND :to
), price AS (
  SELECT p.id AS id_precio, pz.precios
  FROM profiles p
  LEFT JOIN precio pz ON pz.id = p.id_precio
  WHERE p.id = :listero
), limited AS (
  SELECT nl.id_horario, nl.numero
  FROM numero_limitado nl
)
-- NOTA: la lógica de pago por premio requiere funciones SQL o cálculo app-side:
--  * parsear res.resultado_numeros (formato 'NNN NNNN') en pick3, pick4, centena, parle, etc.
--  * determinar matches contra j.numeros
--  * aplicar tarifa de price.precios -> {tipo}.{limited|regular}
-- A continuación se muestra sólo el esqueleto de agregación final:
, payment AS (
  SELECT j.id AS jugada_id,
         j.day,
         j.id_horario,
         0.0::numeric AS pago -- Reemplazar por suma de pagos calculados por número
  FROM j
  LEFT JOIN res ON res.id_horario = j.id_horario AND res.day = j.day
  -- LEFT JOIN limited ON limited.id_horario = j.id_horario ...
  -- LEFT JOIN price ON price.id_precio IS NOT NULL ...
)
SELECT
  j.day,
  SUM(j.monto_recogido_inferido)::numeric(12,2) AS total_recogido,
  COALESCE(SUM(payment.pago),0)::numeric(12,2) AS total_pagado,
  (SUM(j.monto_recogido_inferido) - COALESCE(SUM(payment.pago),0))::numeric(12,2) AS balance
FROM j
LEFT JOIN payment ON payment.jugada_id = j.id
GROUP BY j.day
ORDER BY j.day DESC;

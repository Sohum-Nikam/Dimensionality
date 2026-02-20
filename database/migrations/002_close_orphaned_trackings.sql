-- Migration: Close orphaned trackings (open for more than 24 hours)
-- Created: 2026-02-20
-- Description: Closes trackings that have been open for more than 24 hours
--              and don't have a continuation in the chain
-- WARNING: Review results before running UPDATE statement

-- Step 1: Preview what will be closed (ALWAYS RUN THIS FIRST)
SELECT 
  id,
  puesto_id,
  lote,
  instancia,
  version,
  fecha_inicio,
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - fecha_inicio)) / 3600 AS hours_open,
  user_id,
  'Will be closed' AS action
FROM trackings
WHERE 
  fecha_final IS NULL
  AND fecha_inicio < CURRENT_TIMESTAMP - INTERVAL '24 hours'
  -- Only close if there's no newer tracking for same window (not part of active chain)
  AND NOT EXISTS (
    SELECT 1 
    FROM trackings t2
    WHERE t2.lote = trackings.lote
      AND t2.instancia = trackings.instancia
      AND t2.version = trackings.version
      AND t2.fecha_inicio > trackings.fecha_inicio
  )
ORDER BY hours_open DESC;

-- Step 2: Close orphaned trackings
-- Set fecha_final to fecha_inicio + 24 hours (or current time if less than 24h has passed)
UPDATE trackings
SET 
  fecha_final = GREATEST(
    fecha_inicio + INTERVAL '24 hours',
    CURRENT_TIMESTAMP - INTERVAL '1 hour'  -- Give 1 hour buffer
  ),
  updated_at = CURRENT_TIMESTAMP,
  closure_reason = 'AUTO_CLOSED_ORPHANED'
WHERE 
  fecha_final IS NULL
  AND fecha_inicio < CURRENT_TIMESTAMP - INTERVAL '24 hours'
  -- Only close if there's no newer tracking for same window
  AND NOT EXISTS (
    SELECT 1 
    FROM trackings t2
    WHERE t2.lote = trackings.lote
      AND t2.instancia = trackings.instancia
      AND t2.version = trackings.version
      AND t2.fecha_inicio > trackings.fecha_inicio
  );

-- Step 3: Verify closure
SELECT 
  COUNT(*) AS closed_count,
  AVG(EXTRACT(EPOCH FROM (fecha_final - fecha_inicio)) / 3600) AS avg_duration_hours
FROM trackings
WHERE closure_reason = 'AUTO_CLOSED_ORPHANED';

-- Step 4: Report remaining open trackings
SELECT 
  puesto_id,
  COUNT(*) AS remaining_open_count
FROM trackings
WHERE fecha_final IS NULL
GROUP BY puesto_id
ORDER BY remaining_open_count DESC;

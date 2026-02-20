-- Monitoring Dashboard Queries
-- Purpose: Real-time metrics for tracking system health
-- Usage: Run these queries periodically or integrate into monitoring dashboard

-- ============================================
-- 1. Current Open Trackings per Puesto
-- ============================================
SELECT 
  puesto_id,
  COUNT(*) AS open_trackings_count,
  ARRAY_AGG(DISTINCT lote) AS active_lotes,
  MIN(fecha_inicio) AS oldest_open_tracking,
  MAX(fecha_inicio) AS newest_open_tracking
FROM trackings
WHERE fecha_final IS NULL
GROUP BY puesto_id
ORDER BY open_trackings_count DESC;

-- ============================================
-- 2. Average Tracking Duration by Puesto
-- ============================================
SELECT 
  puesto_id,
  COUNT(*) AS completed_trackings,
  ROUND(AVG(EXTRACT(EPOCH FROM (fecha_final - fecha_inicio)) / 60), 2) AS avg_duration_minutes,
  ROUND(MIN(EXTRACT(EPOCH FROM (fecha_final - fecha_inicio)) / 60), 2) AS min_duration_minutes,
  ROUND(MAX(EXTRACT(EPOCH FROM (fecha_final - fecha_inicio)) / 60), 2) AS max_duration_minutes,
  ROUND(SUM(EXTRACT(EPOCH FROM (fecha_final - fecha_inicio)) / 3600), 2) AS total_hours
FROM trackings
WHERE fecha_final IS NOT NULL
  AND fecha_inicio >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY puesto_id
ORDER BY avg_duration_minutes DESC;

-- ============================================
-- 3. Orphaned Trackings Alert (>12 hours open)
-- ============================================
SELECT 
  puesto_id,
  lote,
  instancia,
  version,
  fecha_inicio,
  ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - fecha_inicio)) / 3600, 2) AS hours_open,
  user_id,
  created_at
FROM trackings
WHERE fecha_final IS NULL
  AND fecha_inicio < CURRENT_TIMESTAMP - INTERVAL '12 hours'
ORDER BY hours_open DESC;

-- ============================================
-- 4. Tracking Activity by Hour (Last 24 hours)
-- ============================================
SELECT 
  DATE_TRUNC('hour', fecha_inicio) AS hour,
  puesto_id,
  COUNT(*) AS tracking_count,
  COUNT(DISTINCT lote) AS unique_windows
FROM trackings
WHERE fecha_inicio >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', fecha_inicio), puesto_id
ORDER BY hour DESC, puesto_id;

-- ============================================
-- 5. Chain Transition Statistics
-- ============================================
SELECT 
  DATE_TRUNC('day', fecha_final) AS date,
  closure_reason,
  COUNT(*) AS transition_count,
  AVG(EXTRACT(EPOCH FROM (fecha_final - fecha_inicio)) / 60) AS avg_duration_minutes
FROM trackings
WHERE closure_reason IN ('CHAIN_TRANSITION', 'RESCANNED_SAME_WINDOW')
  AND fecha_final >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', fecha_final), closure_reason
ORDER BY date DESC;

-- ============================================
-- 6. Window Flow Analysis (Most Active Windows)
-- ============================================
SELECT 
  lote,
  instancia,
  version,
  COUNT(*) AS total_trackings,
  COUNT(DISTINCT puesto_id) AS puestos_used,
  MIN(fecha_inicio) AS first_tracking,
  MAX(COALESCE(fecha_final, CURRENT_TIMESTAMP)) AS last_activity,
  SUM(EXTRACT(EPOCH FROM (COALESCE(fecha_final, CURRENT_TIMESTAMP) - fecha_inicio)) / 3600) AS total_hours
FROM trackings
WHERE fecha_inicio >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY lote, instancia, version
HAVING COUNT(*) > 1
ORDER BY total_trackings DESC
LIMIT 20;

-- ============================================
-- 7. Validation Failures (from logs or error tracking)
-- ============================================
-- Note: This assumes you have an error_log table
-- If not, create one or use application logs
SELECT 
  DATE_TRUNC('hour', created_at) AS hour,
  error_type,
  COUNT(*) AS error_count,
  puesto_id
FROM error_log
WHERE error_type LIKE '%tracking%'
  AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), error_type, puesto_id
ORDER BY hour DESC, error_count DESC;

-- ============================================
-- 8. Health Check Summary
-- ============================================
SELECT 
  'Total Open Trackings' AS metric,
  COUNT(*)::text AS value
FROM trackings
WHERE fecha_final IS NULL

UNION ALL

SELECT 
  'Orphaned Trackings (>24h)' AS metric,
  COUNT(*)::text AS value
FROM trackings
WHERE fecha_final IS NULL
  AND fecha_inicio < CURRENT_TIMESTAMP - INTERVAL '24 hours'

UNION ALL

SELECT 
  'Trackings Created Today' AS metric,
  COUNT(*)::text AS value
FROM trackings
WHERE DATE(fecha_inicio) = CURRENT_DATE

UNION ALL

SELECT 
  'Average Duration (minutes)' AS metric,
  ROUND(AVG(EXTRACT(EPOCH FROM (fecha_final - fecha_inicio)) / 60), 2)::text AS value
FROM trackings
WHERE fecha_final IS NOT NULL
  AND fecha_inicio >= CURRENT_DATE - INTERVAL '7 days'

UNION ALL

SELECT 
  'Puestos with Open Trackings' AS metric,
  COUNT(DISTINCT puesto_id)::text AS value
FROM trackings
WHERE fecha_final IS NULL;

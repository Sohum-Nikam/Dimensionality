/**
 * Tracking Service
 * Handles all tracking operations with validation and chain logic
 * Prevents time overlaps and ensures data integrity
 */

import { db } from '../config/database';
import { logger } from '../utils/logger';

export interface TrackingData {
  puesto_id: number;
  lote: string;
  instancia: number;
  version: number;
  fecha_inicio: Date;
  user_id?: number;
}

export interface TrackingRecord {
  id: number;
  puesto_id: number;
  lote: string;
  instancia: number;
  version: number;
  fecha_inicio: Date;
  fecha_final: Date | null;
  user_id: number | null;
  closure_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Create a new tracking record with validation
 * Implements chain logic: closes tracking in previous puesto when window moves
 * Prevents overlaps: ensures no open tracking exists in same puesto
 */
export async function createTracking(data: TrackingData): Promise<TrackingRecord> {
  const startTime = Date.now();
  
  logger.info({
    event: 'tracking_create_attempt',
    puesto_id: data.puesto_id,
    lote: data.lote,
    instancia: data.instancia,
    version: data.version,
    fecha_inicio: data.fecha_inicio,
    user_id: data.user_id
  });

  try {
    // Step 1: Check for open tracking in OTHER puesto (chain logic)
    // If window is open elsewhere, close it (window moved to this puesto)
    await closeTrackingInOtherPuesto(data);

    // Step 2: Check for open tracking in SAME puesto (overlap prevention)
    const openInSamePuesto = await findOpenTrackingInPuesto(data.puesto_id);
    
    if (openInSamePuesto) {
      // If same window, close existing and create new
      if (openInSamePuesto.lote === data.lote && 
          openInSamePuesto.instancia === data.instancia && 
          openInSamePuesto.version === data.version) {
        
        logger.info({
          event: 'tracking_same_window_rescan',
          existing_tracking_id: openInSamePuesto.id,
          new_puesto_id: data.puesto_id,
          lote: data.lote
        });

        await closeTracking(openInSamePuesto.id, data.fecha_inicio, 'RESCANNED_SAME_WINDOW');
      } else {
        // Different window - ERROR: puesto can't work on two windows simultaneously
        const error = new Error(
          `Cannot create tracking: Workstation ${data.puesto_id} already has open tracking ` +
          `for window (lote: ${openInSamePuesto.lote}, instancia: ${openInSamePuesto.instancia}, ` +
          `version: ${openInSamePuesto.version}) started at ${openInSamePuesto.fecha_inicio}`
        );

        logger.warn({
          event: 'tracking_validation_failed',
          puesto_id: data.puesto_id,
          lote: data.lote,
          instancia: data.instancia,
          version: data.version,
          reason: 'open_tracking_exists_different_window',
          conflicting_tracking_id: openInSamePuesto.id,
          conflicting_lote: openInSamePuesto.lote,
          conflicting_instancia: openInSamePuesto.instancia,
          conflicting_version: openInSamePuesto.version
        });

        throw error;
      }
    }

    // Step 3: Create new tracking
    const result = await db.query<TrackingRecord>(`
      INSERT INTO trackings (
        puesto_id, lote, instancia, version, fecha_inicio, user_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      data.puesto_id,
      data.lote,
      data.instancia,
      data.version,
      data.fecha_inicio,
      data.user_id || null
    ]);

    const tracking = result.rows[0];

    logger.info({
      event: 'tracking_created',
      tracking_id: tracking.id,
      puesto_id: tracking.puesto_id,
      lote: tracking.lote,
      instancia: tracking.instancia,
      version: tracking.version,
      fecha_inicio: tracking.fecha_inicio,
      duration_ms: Date.now() - startTime
    });

    return tracking;

  } catch (error: any) {
    // Check if it's a constraint violation
    if (error.code === '23505') { // Unique violation
      logger.error({
        event: 'tracking_constraint_violation',
        puesto_id: data.puesto_id,
        lote: data.lote,
        instancia: data.instancia,
        version: data.version,
        error: error.message,
        constraint: error.constraint
      });
      
      throw new Error(
        `Database constraint violation: A tracking already exists for this combination. ` +
        `This should have been caught by validation. Please check for concurrent operations.`
      );
    }

    logger.error({
      event: 'tracking_create_error',
      puesto_id: data.puesto_id,
      lote: data.lote,
      instancia: data.instancia,
      version: data.version,
      error: error.message,
      stack: error.stack
    });

    throw error;
  }
}

/**
 * Close tracking in other puesto when window moves (chain logic)
 */
async function closeTrackingInOtherPuesto(data: TrackingData): Promise<void> {
  const result = await db.query<TrackingRecord>(`
    SELECT id, puesto_id, fecha_inicio
    FROM trackings
    WHERE lote = $1
      AND instancia = $2
      AND version = $3
      AND puesto_id != $4
      AND fecha_final IS NULL
    ORDER BY fecha_inicio DESC
    LIMIT 1
  `, [data.lote, data.instancia, data.version, data.puesto_id]);

  if (result.rows.length > 0) {
    const previousTracking = result.rows[0];
    
    await closeTracking(previousTracking.id, data.fecha_inicio, 'CHAIN_TRANSITION');

    logger.info({
      event: 'tracking_chain_transition',
      from_puesto: previousTracking.puesto_id,
      to_puesto: data.puesto_id,
      lote: data.lote,
      instancia: data.instancia,
      version: data.version,
      transition_time: data.fecha_inicio,
      previous_tracking_id: previousTracking.id
    });
  }
}

/**
 * Find open tracking in specific puesto
 */
async function findOpenTrackingInPuesto(puestoId: number): Promise<TrackingRecord | null> {
  const result = await db.query<TrackingRecord>(`
    SELECT id, puesto_id, lote, instancia, version, fecha_inicio, fecha_final, user_id
    FROM trackings
    WHERE puesto_id = $1
      AND fecha_final IS NULL
    ORDER BY fecha_inicio DESC
    LIMIT 1
  `, [puestoId]);

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Close a tracking record
 */
export async function closeTracking(
  trackingId: number, 
  fechaFinal: Date, 
  reason: string = 'MANUAL_CLOSE'
): Promise<void> {
  await db.query(`
    UPDATE trackings
    SET 
      fecha_final = $1,
      closure_reason = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
  `, [fechaFinal, reason, trackingId]);

  logger.info({
    event: 'tracking_closed',
    tracking_id: trackingId,
    fecha_final: fechaFinal,
    closure_reason: reason
  });
}

/**
 * Get tracking by ID
 */
export async function getTracking(trackingId: number): Promise<TrackingRecord | null> {
  const result = await db.query<TrackingRecord>(`
    SELECT * FROM trackings WHERE id = $1
  `, [trackingId]);

  return result.rows.length > 0 ? result.rows[0] : null;
}

/**
 * Find all overlaps (for monitoring)
 */
export async function findOverlaps(): Promise<any[]> {
  const result = await db.query(`
    WITH tracking_periods AS (
      SELECT 
        id, puesto_id, lote, instancia, version,
        fecha_inicio,
        COALESCE(fecha_final, CURRENT_TIMESTAMP) AS fecha_final
      FROM trackings
    )
    SELECT 
      t1.id AS tracking1_id,
      t1.puesto_id,
      t1.lote AS lote1,
      t1.instancia AS instancia1,
      t1.version AS version1,
      t1.fecha_inicio AS inicio1,
      t1.fecha_final AS final1,
      t2.id AS tracking2_id,
      t2.lote AS lote2,
      t2.instancia AS instancia2,
      t2.version AS version2,
      t2.fecha_inicio AS inicio2,
      t2.fecha_final AS final2,
      EXTRACT(EPOCH FROM (
        LEAST(t1.fecha_final, t2.fecha_final) - 
        GREATEST(t1.fecha_inicio, t2.fecha_inicio)
      )) AS overlap_seconds
    FROM tracking_periods t1
    INNER JOIN tracking_periods t2
      ON t1.puesto_id = t2.puesto_id
      AND t1.id < t2.id
    WHERE 
      t1.fecha_inicio < t2.fecha_final
      AND t1.fecha_final > t2.fecha_inicio
    ORDER BY overlap_seconds DESC
  `);

  return result.rows;
}

/**
 * Unit Tests for Tracking Service
 * Tests validation logic, chain transitions, and overlap prevention
 */

import { 
  createTracking, 
  closeTracking, 
  getTracking, 
  findOverlaps,
  TrackingData 
} from '../services/trackingService';
import { db } from '../config/database';

// Mock database
jest.mock('../config/database');
jest.mock('../utils/logger');

describe('Tracking Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTracking - Validation', () => {
    it('should prevent creating tracking when different window is open in same puesto', async () => {
      // Setup: Mock open tracking for lote A
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [] // No tracking in other puesto
      }).mockResolvedValueOnce({
        rows: [{
          id: 1,
          puesto_id: 1,
          lote: 'A',
          instancia: 1,
          version: 1,
          fecha_inicio: new Date('2026-02-20T10:00:00'),
          fecha_final: null
        }]
      });

      // Attempt: Create tracking for lote B in same puesto
      const data: TrackingData = {
        puesto_id: 1,
        lote: 'B',
        instancia: 1,
        version: 1,
        fecha_inicio: new Date('2026-02-20T11:00:00')
      };

      await expect(createTracking(data)).rejects.toThrow(
        'Cannot create tracking: Workstation 1 already has open tracking'
      );
    });

    it('should close existing tracking when same window is scanned again', async () => {
      const existingTracking = {
        id: 1,
        puesto_id: 1,
        lote: 'A',
        instancia: 1,
        version: 1,
        fecha_inicio: new Date('2026-02-20T10:00:00'),
        fecha_final: null
      };

      // Mock: No tracking in other puesto, existing tracking found, then close, then create
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // No tracking in other puesto
        .mockResolvedValueOnce({ rows: [existingTracking] }) // Find open in same puesto
        .mockResolvedValueOnce({ rows: [] }) // Close existing
        .mockResolvedValueOnce({ 
          rows: [{
            id: 2,
            ...existingTracking,
            fecha_final: new Date('2026-02-20T11:00:00')
          }]
        }); // Create new

      const data: TrackingData = {
        puesto_id: 1,
        lote: 'A',
        instancia: 1,
        version: 1,
        fecha_inicio: new Date('2026-02-20T11:00:00')
      };

      const result = await createTracking(data);

      expect(result.id).toBe(2);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trackings'),
        expect.arrayContaining([expect.any(Date), 'RESCANNED_SAME_WINDOW', 1])
      );
    });

    it('should allow chain transition (puesto 1 → puesto 2)', async () => {
      const previousTracking = {
        id: 1,
        puesto_id: 1,
        lote: 'A',
        instancia: 1,
        version: 1,
        fecha_inicio: new Date('2026-02-20T10:00:00'),
        fecha_final: null
      };

      // Mock: Find tracking in other puesto, close it, no open in new puesto, create new
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [previousTracking] }) // Find in other puesto
        .mockResolvedValueOnce({ rows: [] }) // Close previous
        .mockResolvedValueOnce({ rows: [] }) // No open in new puesto
        .mockResolvedValueOnce({ 
          rows: [{
            id: 2,
            puesto_id: 2,
            lote: 'A',
            instancia: 1,
            version: 1,
            fecha_inicio: new Date('2026-02-20T10:30:00'),
            fecha_final: null
          }]
        }); // Create new

      const data: TrackingData = {
        puesto_id: 2,
        lote: 'A',
        instancia: 1,
        version: 1,
        fecha_inicio: new Date('2026-02-20T10:30:00')
      };

      const result = await createTracking(data);

      expect(result.puesto_id).toBe(2);
      expect(result.lote).toBe('A');
      // Verify previous tracking was closed
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trackings'),
        expect.arrayContaining([expect.any(Date), 'CHAIN_TRANSITION', 1])
      );
    });

    it('should enforce unique constraint for open trackings', async () => {
      // Mock: No tracking in other puesto, no open in same puesto, but constraint violation on insert
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // No tracking in other puesto
        .mockResolvedValueOnce({ rows: [] }) // No open in same puesto
        .mockRejectedValueOnce({ 
          code: '23505', 
          constraint: 'idx_unique_open_tracking',
          message: 'duplicate key value violates unique constraint'
        }); // Constraint violation

      const data: TrackingData = {
        puesto_id: 1,
        lote: 'A',
        instancia: 1,
        version: 1,
        fecha_inicio: new Date('2026-02-20T10:00:00')
      };

      await expect(createTracking(data)).rejects.toThrow(
        'Database constraint violation'
      );
    });
  });

  describe('closeTracking', () => {
    it('should close tracking with reason', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      await closeTracking(1, new Date('2026-02-20T11:00:00'), 'MANUAL_CLOSE');

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE trackings'),
        expect.arrayContaining([
          expect.any(Date),
          'MANUAL_CLOSE',
          1
        ])
      );
    });
  });

  describe('getTracking', () => {
    it('should return tracking by ID', async () => {
      const tracking = {
        id: 1,
        puesto_id: 1,
        lote: 'A',
        instancia: 1,
        version: 1,
        fecha_inicio: new Date('2026-02-20T10:00:00'),
        fecha_final: new Date('2026-02-20T11:00:00'),
        user_id: 1,
        closure_reason: 'MANUAL_CLOSE',
        created_at: new Date('2026-02-20T10:00:00'),
        updated_at: new Date('2026-02-20T11:00:00')
      };

      (db.query as jest.Mock).mockResolvedValue({ rows: [tracking] });

      const result = await getTracking(1);

      expect(result).toEqual(tracking);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM trackings'),
        [1]
      );
    });

    it('should return null if tracking not found', async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });

      const result = await getTracking(999);

      expect(result).toBeNull();
    });
  });

  describe('findOverlaps', () => {
    it('should find overlapping trackings', async () => {
      const overlaps = [
        {
          tracking1_id: 1,
          puesto_id: 1,
          lote1: 'A',
          tracking2_id: 2,
          lote2: 'B',
          overlap_seconds: 3600
        }
      ];

      (db.query as jest.Mock).mockResolvedValue({ rows: overlaps });

      const result = await findOverlaps();

      expect(result).toEqual(overlaps);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('WITH tracking_periods')
      );
    });
  });
});

/**
 * Integration Tests for Tracking Service
 * Tests complete chain workflow and concurrent operations
 */

import { 
  createTracking, 
  getTracking, 
  findOverlaps,
  TrackingData 
} from '../services/trackingService';
import { db } from '../config/database';

// Note: These tests require a test database
// Set TEST_DATABASE_URL environment variable

describe('Tracking Service - Integration Tests', () => {
  const testWindow = {
    lote: 'TEST001',
    instancia: 1,
    version: 1
  };

  beforeEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM trackings WHERE lote = $1', [testWindow.lote]);
  });

  afterAll(async () => {
    // Final cleanup
    await db.query('DELETE FROM trackings WHERE lote = $1', [testWindow.lote]);
    await db.query('DELETE FROM trackings WHERE lote LIKE $1', ['TEST%']);
  });

  describe('Chain Workflow', () => {
    it('should handle complete chain: puesto 1 → puesto 2 → puesto 3', async () => {
      // Step 1: Start in puesto 1
      const t1 = await createTracking({
        puesto_id: 1,
        ...testWindow,
        fecha_inicio: new Date('2026-02-20T10:00:00')
      });

      expect(t1.fecha_final).toBeNull();
      expect(t1.puesto_id).toBe(1);

      // Step 2: Move to puesto 2
      const t2 = await createTracking({
        puesto_id: 2,
        ...testWindow,
        fecha_inicio: new Date('2026-02-20T10:30:00')
      });

      const closed_t1 = await getTracking(t1.id);
      expect(closed_t1?.fecha_final).toEqual(new Date('2026-02-20T10:30:00'));
      expect(closed_t1?.closure_reason).toBe('CHAIN_TRANSITION');
      expect(t2.fecha_final).toBeNull();
      expect(t2.puesto_id).toBe(2);

      // Step 3: Move to puesto 3
      const t3 = await createTracking({
        puesto_id: 3,
        ...testWindow,
        fecha_inicio: new Date('2026-02-20T11:00:00')
      });

      const closed_t2 = await getTracking(t2.id);
      expect(closed_t2?.fecha_final).toEqual(new Date('2026-02-20T11:00:00'));
      expect(closed_t2?.closure_reason).toBe('CHAIN_TRANSITION');
      expect(t3.fecha_final).toBeNull();
      expect(t3.puesto_id).toBe(3);

      // Verify: No overlaps exist
      const overlaps = await findOverlaps();
      const testOverlaps = overlaps.filter(o => 
        (o.lote1 === testWindow.lote || o.lote2 === testWindow.lote) &&
        o.instancia1 === testWindow.instancia &&
        o.version1 === testWindow.version
      );
      expect(testOverlaps).toHaveLength(0);
    });

    it('should prevent multiple windows in same puesto simultaneously', async () => {
      // Create tracking for window A in puesto 1
      await createTracking({
        puesto_id: 1,
        lote: 'TEST_A',
        instancia: 1,
        version: 1,
        fecha_inicio: new Date('2026-02-20T10:00:00')
      });

      // Attempt to create tracking for window B in same puesto (should fail)
      await expect(
        createTracking({
          puesto_id: 1,
          lote: 'TEST_B',
          instancia: 1,
          version: 1,
          fecha_inicio: new Date('2026-02-20T10:30:00')
        })
      ).rejects.toThrow('Cannot create tracking: Workstation 1 already has open tracking');

      // Cleanup
      await db.query('DELETE FROM trackings WHERE lote IN ($1, $2)', ['TEST_A', 'TEST_B']);
    });

    it('should handle concurrent tracking creation attempts', async () => {
      // Simulate concurrent creation attempts
      const promises = [
        createTracking({
          puesto_id: 1,
          ...testWindow,
          fecha_inicio: new Date('2026-02-20T10:00:00')
        }),
        createTracking({
          puesto_id: 1,
          ...testWindow,
          fecha_inicio: new Date('2026-02-20T10:00:00')
        })
      ];

      const results = await Promise.allSettled(promises);

      // One should succeed, one should fail (constraint violation or validation)
      const succeeded = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      expect(succeeded.length).toBeGreaterThanOrEqual(1);
      expect(failed.length).toBeGreaterThanOrEqual(1);

      // Verify only one open tracking exists
      const result = await db.query(
        'SELECT COUNT(*) FROM trackings WHERE puesto_id = $1 AND fecha_final IS NULL',
        [1]
      );
      expect(parseInt(result.rows[0].count)).toBeLessThanOrEqual(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rescanning same window in same puesto', async () => {
      // Create initial tracking
      const t1 = await createTracking({
        puesto_id: 1,
        ...testWindow,
        fecha_inicio: new Date('2026-02-20T10:00:00')
      });

      // Rescan same window
      const t2 = await createTracking({
        puesto_id: 1,
        ...testWindow,
        fecha_inicio: new Date('2026-02-20T10:30:00')
      });

      const closed_t1 = await getTracking(t1.id);
      expect(closed_t1?.fecha_final).toEqual(new Date('2026-02-20T10:30:00'));
      expect(closed_t1?.closure_reason).toBe('RESCANNED_SAME_WINDOW');
      expect(t2.fecha_final).toBeNull();
    });

    it('should handle window moving back to previous puesto', async () => {
      // Create chain: puesto 1 → puesto 2
      const t1 = await createTracking({
        puesto_id: 1,
        ...testWindow,
        fecha_inicio: new Date('2026-02-20T10:00:00')
      });

      const t2 = await createTracking({
        puesto_id: 2,
        ...testWindow,
        fecha_inicio: new Date('2026-02-20T10:30:00')
      });

      // Move back to puesto 1
      const t3 = await createTracking({
        puesto_id: 1,
        ...testWindow,
        fecha_inicio: new Date('2026-02-20T11:00:00')
      });

      const closed_t2 = await getTracking(t2.id);
      expect(closed_t2?.fecha_final).toEqual(new Date('2026-02-20T11:00:00'));
      expect(closed_t2?.closure_reason).toBe('CHAIN_TRANSITION');
      expect(t3.puesto_id).toBe(1);
    });
  });
});

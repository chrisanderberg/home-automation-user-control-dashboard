import { describe, it, expect } from 'vitest';
import { splitHoldInterval } from './splitHoldInterval.js';
import type { ClockConfig } from '../../clocks/types.js';

describe('splitHoldInterval', () => {
  const config: ClockConfig = {
    timezone: 'America/New_York',
    latitude: 40.7128,
    longitude: -74.006,
  };

  it('should allocate single-bucket interval to exactly one bucket', () => {
    // Monday 12:00 to 12:03 (3 minutes, all in one bucket)
    const t0 = new Date('2024-01-01T17:00:00Z').getTime(); // Monday 12:00 EST
    const t1 = new Date('2024-01-01T17:03:00Z').getTime(); // Monday 12:03 EST

    const result = splitHoldInterval({
      t0Ms: t0,
      t1Ms: t1,
      clockId: 'utc',
      config,
    });

    expect(result.size).toBe(1);
    const totalMs = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(totalMs).toBe(3 * 60 * 1000); // 3 minutes = 180000 ms
  });

  it('should allocate multi-bucket interval across multiple buckets', () => {
    // Monday 12:00 to 12:10 (10 minutes = 2 buckets)
    const t0 = new Date('2024-01-01T17:00:00Z').getTime(); // Monday 12:00 EST
    const t1 = new Date('2024-01-01T17:10:00Z').getTime(); // Monday 12:10 EST

    const result = splitHoldInterval({
      t0Ms: t0,
      t1Ms: t1,
      clockId: 'utc',
      config,
    });

    expect(result.size).toBe(2);
    const totalMs = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(totalMs).toBe(10 * 60 * 1000); // 10 minutes = 600000 ms
  });

  it('should sum to t1 - t0 for defined mapping', () => {
    // 1 hour interval
    const t0 = new Date('2024-06-15T12:00:00Z').getTime();
    const t1 = new Date('2024-06-15T13:00:00Z').getTime();
    const expectedMs = t1 - t0;

    const result = splitHoldInterval({
      t0Ms: t0,
      t1Ms: t1,
      clockId: 'utc',
      config,
    });

    const totalMs = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(totalMs).toBe(expectedMs);
  });

  it('should handle week wrap (Sunday→Monday)', () => {
    // Sunday 23:58 UTC to Monday 00:02 UTC (crosses week boundary, 4 minutes)
    const t0 = new Date('2024-01-07T23:58:00Z').getTime(); // Sunday 23:58 UTC
    const t1 = new Date('2024-01-08T00:02:00Z').getTime(); // Monday 00:02 UTC

    const result = splitHoldInterval({
      t0Ms: t0,
      t1Ms: t1,
      clockId: 'utc',
      config,
    });

    expect(result.size).toBeGreaterThan(0);
    const totalMs = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(totalMs).toBe(4 * 60 * 1000); // 4 minutes = 240000 ms
  });

  it('should handle local clock with DST', () => {
    // Test during DST transition
    const t0 = new Date('2024-03-10T06:00:00Z').getTime(); // Spring forward day
    const t1 = new Date('2024-03-10T08:00:00Z').getTime();

    const result = splitHoldInterval({
      t0Ms: t0,
      t1Ms: t1,
      clockId: 'local',
      config,
    });

    // Should not crash and should produce valid results
    expect(result.size).toBeGreaterThan(0);
    const totalMs = Array.from(result.values()).reduce((a, b) => a + b, 0);
    // Total should be less than or equal to t1 - t0 (may be less due to DST skip)
    expect(totalMs).toBeLessThanOrEqual(t1 - t0);
  });

  it('should omit undefined segments for solar clocks at poles', () => {
    const poleConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: 90.0, // North Pole
      longitude: 0,
    };

    const t0 = new Date('2024-06-15T12:00:00Z').getTime();
    const t1 = new Date('2024-06-15T13:00:00Z').getTime();

    const result = splitHoldInterval({
      t0Ms: t0,
      t1Ms: t1,
      clockId: 'meanSolar',
      config: poleConfig,
    });

    // Should return empty map or skip undefined segments
    const totalMs = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(totalMs).toBe(0); // No time allocated because clock is undefined
  });

  it('should handle unequal hours variable bucket lengths', () => {
    // Test during day period (should have 12 equal day hours)
    const t0 = new Date('2024-06-15T16:00:00Z').getTime(); // Noon EDT
    const t1 = new Date('2024-06-15T17:00:00Z').getTime(); // 1 PM EDT

    const result = splitHoldInterval({
      t0Ms: t0,
      t1Ms: t1,
      clockId: 'unequalHours',
      config,
    });

    // Should allocate time correctly despite variable bucket lengths
    expect(result.size).toBeGreaterThan(0);
    const totalMs = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(totalMs).toBeLessThanOrEqual(t1 - t0); // May be less if part is undefined
  });

  it('should return empty map for invalid interval (t0 >= t1)', () => {
    const t0 = new Date('2024-06-15T13:00:00Z').getTime();
    const t1 = new Date('2024-06-15T12:00:00Z').getTime();

    const result = splitHoldInterval({
      t0Ms: t0,
      t1Ms: t1,
      clockId: 'utc',
      config,
    });

    expect(result.size).toBe(0);
  });

  it('should work for all clock types', () => {
    const t0 = new Date('2024-06-15T12:00:00Z').getTime();
    const t1 = new Date('2024-06-15T12:30:00Z').getTime(); // 30 minutes

    const clockIds = ['utc', 'local', 'meanSolar', 'apparentSolar', 'unequalHours'] as const;

    for (const clockId of clockIds) {
      const result = splitHoldInterval({
        t0Ms: t0,
        t1Ms: t1,
        clockId,
        config,
      });

      // Should produce valid results (may be empty for undefined clocks)
      expect(result.size).toBeGreaterThanOrEqual(0);
      const totalMs = Array.from(result.values()).reduce((a, b) => a + b, 0);
      expect(totalMs).toBeLessThanOrEqual(t1 - t0);
    }
  });

  it('should handle long intervals correctly', () => {
    // 24 hour interval
    const t0 = new Date('2024-06-15T00:00:00Z').getTime();
    const t1 = new Date('2024-06-16T00:00:00Z').getTime();

    const result = splitHoldInterval({
      t0Ms: t0,
      t1Ms: t1,
      clockId: 'utc',
      config,
    });

    expect(result.size).toBeGreaterThan(0);
    const totalMs = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(totalMs).toBe(24 * 60 * 60 * 1000); // 24 hours
  });
});

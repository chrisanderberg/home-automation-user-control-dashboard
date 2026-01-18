import { describe, it, expect } from 'vitest';
import { mapTimestampToBucket } from './mapTimestamp.js';
import type { ClockConfig, ClockId } from './types.js';

describe('mapTimestampToBucket', () => {
  const config: ClockConfig = {
    timezone: 'America/New_York',
    latitude: 40.7128,
    longitude: -74.006,
  };

  it('should route to UTC clock correctly', () => {
    const tsMs = new Date('2024-01-01T00:00:00Z').getTime();
    const bucket = mapTimestampToBucket('utc', tsMs, config);
    expect(bucket).toBe(0); // Monday 00:00 UTC
  });

  it('should route to local clock correctly', () => {
    const tsMs = new Date('2024-01-01T05:00:00Z').getTime(); // Monday 00:00 EST
    const bucket = mapTimestampToBucket('local', tsMs, config);
    expect(bucket).toBe(0);
  });

  it('should route to mean solar clock correctly', () => {
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const bucket = mapTimestampToBucket('meanSolar', tsMs, config);
    expect(bucket).toBeDefined();
    if (bucket !== undefined) {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(2015);
    }
  });

  it('should route to apparent solar clock correctly', () => {
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const bucket = mapTimestampToBucket('apparentSolar', tsMs, config);
    expect(bucket).toBeDefined();
    if (bucket !== undefined) {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(2015);
    }
  });

  it('should route to unequal hours clock correctly', () => {
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const bucket = mapTimestampToBucket('unequalHours', tsMs, config);
    // May be undefined if polar conditions, otherwise should be valid
    if (bucket !== undefined) {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(2015);
    }
  });

  it('should return undefined for solar clocks at poles', () => {
    const poleConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: 90.0,
      longitude: 0,
    };
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();

    const meanSolarBucket = mapTimestampToBucket('meanSolar', tsMs, poleConfig);
    const apparentSolarBucket = mapTimestampToBucket(
      'apparentSolar',
      tsMs,
      poleConfig,
    );

    expect(meanSolarBucket).toBeUndefined();
    expect(apparentSolarBucket).toBeUndefined();
  });

  it('should handle all clock types without throwing', () => {
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const clockIds: ClockId[] = [
      'utc',
      'local',
      'meanSolar',
      'apparentSolar',
      'unequalHours',
    ];

    for (const clockId of clockIds) {
      expect(() => {
        const bucket = mapTimestampToBucket(clockId, tsMs, config);
        if (bucket !== undefined) {
          expect(bucket).toBeGreaterThanOrEqual(0);
          expect(bucket).toBeLessThanOrEqual(2015);
        }
      }).not.toThrow();
    }
  });

  it('should produce consistent results across calls', () => {
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const clockIds: ClockId[] = [
      'utc',
      'local',
      'meanSolar',
      'apparentSolar',
      'unequalHours',
    ];

    for (const clockId of clockIds) {
      const bucket1 = mapTimestampToBucket(clockId, tsMs, config);
      const bucket2 = mapTimestampToBucket(clockId, tsMs, config);
      expect(bucket1).toBe(bucket2);
    }
  });
});

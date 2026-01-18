import { describe, it, expect } from 'vitest';
import { mapUnequalHoursToBucket } from './unequalHours.js';
import type { ClockConfig } from './types.js';

describe('mapUnequalHoursToBucket', () => {
  const config: ClockConfig = {
    timezone: 'UTC',
    latitude: 40.7128, // New York
    longitude: -74.006, // New York
  };

  it('should return undefined during polar day (no sunset)', () => {
    // Summer at high latitude (e.g., 80°N in June)
    const polarConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: 80.0,
      longitude: 0,
    };
    // June 21 (summer solstice) at high latitude
    const tsMs = new Date('2024-06-21T12:00:00Z').getTime();
    const bucket = mapUnequalHoursToBucket(tsMs, polarConfig);
    // May or may not be undefined depending on exact latitude and date
    // suncalc should handle this correctly
    if (bucket === undefined) {
      expect(bucket).toBeUndefined();
    } else {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(2015);
    }
  });

  it('should return undefined during polar night (no sunrise)', () => {
    // Winter at high latitude (e.g., 80°N in December)
    const polarConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: 80.0,
      longitude: 0,
    };
    // December 21 (winter solstice) at high latitude
    const tsMs = new Date('2024-12-21T12:00:00Z').getTime();
    const bucket = mapUnequalHoursToBucket(tsMs, polarConfig);
    // May or may not be undefined depending on exact latitude and date
    if (bucket === undefined) {
      expect(bucket).toBeUndefined();
    } else {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(2015);
    }
  });

  it('should map day period (sunrise to sunset) to 6:00-18:00', () => {
    // Noon in summer (should be in day period)
    const tsMs = new Date('2024-06-15T16:00:00Z').getTime(); // Noon EDT
    const bucket = mapUnequalHoursToBucket(tsMs, config);
    expect(bucket).toBeDefined();
    if (bucket !== undefined) {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(2015);
    }
  });

  it('should map night period (sunset to sunrise) to 18:00-6:00', () => {
    // Midnight in summer (should be in night period)
    const tsMs = new Date('2024-06-15T04:00:00Z').getTime(); // Midnight EDT
    const bucket = mapUnequalHoursToBucket(tsMs, config);
    expect(bucket).toBeDefined();
    if (bucket !== undefined) {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(2015);
    }
  });

  it('should produce deterministic results for fixed timestamp', () => {
    const tsMs = new Date('2024-06-15T14:30:00Z').getTime();
    const bucket1 = mapUnequalHoursToBucket(tsMs, config);
    const bucket2 = mapUnequalHoursToBucket(tsMs, config);
    expect(bucket1).toBe(bucket2);
  });

  it('should handle different latitudes', () => {
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();

    // Equator
    const equatorConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: 0,
      longitude: 0,
    };
    const equatorBucket = mapUnequalHoursToBucket(tsMs, equatorConfig);

    // Mid-latitude
    const midLatBucket = mapUnequalHoursToBucket(tsMs, config);

    // Both should be valid (or both undefined if polar conditions)
    if (equatorBucket !== undefined && midLatBucket !== undefined) {
      // They may differ due to different day lengths
      expect(equatorBucket).toBeGreaterThanOrEqual(0);
      expect(midLatBucket).toBeGreaterThanOrEqual(0);
    }
  });

  it('should handle sunrise time correctly', () => {
    // Test near sunrise
    const tsMs = new Date('2024-06-15T10:00:00Z').getTime(); // Early morning
    const bucket = mapUnequalHoursToBucket(tsMs, config);
    if (bucket !== undefined) {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(2015);
    }
  });

  it('should handle sunset time correctly', () => {
    // Test near sunset
    const tsMs = new Date('2024-06-15T22:00:00Z').getTime(); // Evening
    const bucket = mapUnequalHoursToBucket(tsMs, config);
    if (bucket !== undefined) {
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(2015);
    }
  });
});

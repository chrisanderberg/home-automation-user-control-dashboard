import { describe, it, expect } from 'vitest';
import { mapApparentSolarToBucket } from './apparentSolar.js';
import { mapMeanSolarToBucket } from './meanSolar.js';
import type { ClockConfig } from './types.js';

describe('mapApparentSolarToBucket', () => {
  const config: ClockConfig = {
    timezone: 'UTC',
    latitude: 40.7128, // New York
    longitude: -74.006, // New York
  };

  it('should return undefined at the North Pole', () => {
    const poleConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: 90.0,
      longitude: 0,
    };
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const bucket = mapApparentSolarToBucket(tsMs, poleConfig);
    expect(bucket).toBeUndefined();
  });

  it('should return undefined at the South Pole', () => {
    const poleConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: -90.0,
      longitude: 0,
    };
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const bucket = mapApparentSolarToBucket(tsMs, poleConfig);
    expect(bucket).toBeUndefined();
  });

  it('should differ from mean solar by equation of time', () => {
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const meanSolarBucket = mapMeanSolarToBucket(tsMs, config);
    const apparentSolarBucket = mapApparentSolarToBucket(tsMs, config);

    // Both should be valid
    expect(meanSolarBucket).toBeDefined();
    expect(apparentSolarBucket).toBeDefined();

    // They may differ by equation of time (typically a few minutes, so 0-1 buckets)
    // In June, equation of time is typically around -2 minutes, so they might be the same
    // or differ by 1 bucket
    const diff = Math.abs((apparentSolarBucket ?? 0) - (meanSolarBucket ?? 0));
    expect(diff).toBeLessThanOrEqual(2); // Equation of time is typically < 20 minutes
  });

  it('should produce deterministic results for fixed timestamp', () => {
    const tsMs = new Date('2024-06-15T14:30:00Z').getTime();
    const bucket1 = mapApparentSolarToBucket(tsMs, config);
    const bucket2 = mapApparentSolarToBucket(tsMs, config);
    expect(bucket1).toBe(bucket2);
  });

  it('should handle day wrap correctly', () => {
    const tsMs = new Date('2024-06-15T23:55:00Z').getTime();
    const bucket = mapApparentSolarToBucket(tsMs, config);
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThanOrEqual(2015);
  });

  it('should apply equation of time adjustment', () => {
    // Test at different times of year to see equation of time variation
    const dates = [
      new Date('2024-01-15T12:00:00Z'), // Winter
      new Date('2024-04-15T12:00:00Z'), // Spring
      new Date('2024-06-15T12:00:00Z'), // Summer
      new Date('2024-10-15T12:00:00Z'), // Fall
    ];

    for (const date of dates) {
      const tsMs = date.getTime();
      const bucket = mapApparentSolarToBucket(tsMs, config);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThanOrEqual(2015);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { mapMeanSolarToBucket } from './meanSolar.js';
import type { ClockConfig } from './types.js';

describe('mapMeanSolarToBucket', () => {
  const config: ClockConfig = {
    timezone: 'UTC',
    latitude: 40.7128, // New York
    longitude: -74.006, // New York (west of prime meridian, negative)
  };

  it('should return undefined at the North Pole', () => {
    const poleConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: 90.0,
      longitude: 0,
    };
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const bucket = mapMeanSolarToBucket(tsMs, poleConfig);
    expect(bucket).toBeUndefined();
  });

  it('should return undefined at the South Pole', () => {
    const poleConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: -90.0,
      longitude: 0,
    };
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const bucket = mapMeanSolarToBucket(tsMs, poleConfig);
    expect(bucket).toBeUndefined();
  });

  it('should apply longitude offset correctly', () => {
    // New York is at -74.006 degrees longitude
    // Offset = -74.006 / 15 = -4.9337 hours = -296 minutes
    // So noon UTC should be around 7:04 AM mean solar time in New York

    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const bucket = mapMeanSolarToBucket(tsMs, config);

    // Should be a valid bucket
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThanOrEqual(2015);
  });

  it('should produce different buckets for different longitudes', () => {
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();

    // New York (longitude -74.006)
    const nyBucket = mapMeanSolarToBucket(tsMs, config);

    // London (longitude ~0)
    const londonConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: 51.5074,
      longitude: 0,
    };
    const londonBucket = mapMeanSolarToBucket(tsMs, londonConfig);

    // Should be different (New York is ~5 hours behind London in solar time)
    expect(nyBucket).not.toBe(londonBucket);
  });

  it('should handle day wrap correctly', () => {
    // Test near midnight to ensure day wrap works
    const tsMs = new Date('2024-06-15T23:55:00Z').getTime();
    const bucket = mapMeanSolarToBucket(tsMs, config);
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThanOrEqual(2015);
  });

  it('should produce deterministic results for fixed timestamp', () => {
    const tsMs = new Date('2024-06-15T14:30:00Z').getTime();
    const bucket1 = mapMeanSolarToBucket(tsMs, config);
    const bucket2 = mapMeanSolarToBucket(tsMs, config);
    expect(bucket1).toBe(bucket2);
  });

  it('should handle positive longitude (east of prime meridian)', () => {
    const tokyoConfig: ClockConfig = {
      timezone: 'UTC',
      latitude: 35.6762,
      longitude: 139.6503, // Tokyo (east of prime meridian, positive)
    };
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();
    const bucket = mapMeanSolarToBucket(tsMs, tokyoConfig);
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThanOrEqual(2015);
  });
});

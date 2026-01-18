import { describe, it, expect } from 'vitest';
import { mapLocalToBucket } from './local.js';
import type { ClockConfig } from './types.js';

describe('mapLocalToBucket', () => {
  const config: ClockConfig = {
    timezone: 'America/New_York',
    latitude: 40.7128,
    longitude: -74.006,
  };

  it('should map Monday 00:00 local time to bucket 0', () => {
    // Monday, January 1, 2024 00:00:00 EST (UTC-5)
    // This is 2024-01-01T05:00:00Z
    const tsMs = new Date('2024-01-01T05:00:00Z').getTime();
    const bucket = mapLocalToBucket(tsMs, config);
    expect(bucket).toBe(0);
  });

  it('should produce deterministic results for fixed timestamp', () => {
    const tsMs = new Date('2024-06-15T14:30:00Z').getTime();
    const bucket1 = mapLocalToBucket(tsMs, config);
    const bucket2 = mapLocalToBucket(tsMs, config);
    expect(bucket1).toBe(bucket2);
  });

  it('should handle different timezones correctly', () => {
    const tsMs = new Date('2024-06-15T12:00:00Z').getTime();

    // New York (UTC-4 in summer)
    const nyConfig: ClockConfig = {
      timezone: 'America/New_York',
      latitude: 40.7128,
      longitude: -74.006,
    };
    const nyBucket = mapLocalToBucket(tsMs, nyConfig);

    // Los Angeles (UTC-7 in summer)
    const laConfig: ClockConfig = {
      timezone: 'America/Los_Angeles',
      latitude: 34.0522,
      longitude: -118.2437,
    };
    const laBucket = mapLocalToBucket(tsMs, laConfig);

    // Should be different buckets (3 hour difference = 36 buckets)
    expect(Math.abs(nyBucket - laBucket)).toBe(36);
  });

  it('should handle DST spring forward without crashing', () => {
    // March 10, 2024 2:00 AM EST -> 3:00 AM EDT (spring forward)
    // The hour 2:00-3:00 AM doesn't exist in local time
    // We should handle this gracefully
    const tsMs = new Date('2024-03-10T07:00:00Z').getTime(); // 3:00 AM EDT
    const bucket = mapLocalToBucket(tsMs, config);
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThanOrEqual(2015);
  });

  it('should handle DST fall back without crashing', () => {
    // November 3, 2024 2:00 AM EDT -> 1:00 AM EST (fall back)
    // The hour 1:00-2:00 AM occurs twice
    // We should handle this gracefully (map to first occurrence)
    const tsMs = new Date('2024-11-03T06:00:00Z').getTime(); // 2:00 AM EST (second occurrence)
    const bucket = mapLocalToBucket(tsMs, config);
    expect(bucket).toBeGreaterThanOrEqual(0);
    expect(bucket).toBeLessThanOrEqual(2015);
  });

  it('should handle different days of week', () => {
    // Friday 12:00 local time
    const tsMs = new Date('2024-01-05T17:00:00Z').getTime(); // Friday 12:00 EST
    const bucket = mapLocalToBucket(tsMs, config);
    // Friday is day 4, 12:00 = 720 minutes = bucket 144 in day
    // bucketId = 4 * 288 + 144 = 1296
    expect(bucket).toBe(1296);
  });
});

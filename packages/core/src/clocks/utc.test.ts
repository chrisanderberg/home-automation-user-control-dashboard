import { describe, it, expect } from 'vitest';
import { mapUtcToBucket } from './utc.js';

describe('mapUtcToBucket', () => {
  it('should map Monday 00:00 UTC to bucket 0', () => {
    // Monday, January 1, 2024 00:00:00 UTC
    const tsMs = new Date('2024-01-01T00:00:00Z').getTime();
    const bucket = mapUtcToBucket(tsMs);
    expect(bucket).toBe(0);
  });

  it('should map Sunday 23:55 UTC to bucket 2015', () => {
    // Sunday, January 7, 2024 23:55:00 UTC
    const tsMs = new Date('2024-01-07T23:55:00Z').getTime();
    const bucket = mapUtcToBucket(tsMs);
    expect(bucket).toBe(2015);
  });

  it('should map Wednesday 12:00 UTC correctly', () => {
    // Wednesday, January 3, 2024 12:00:00 UTC
    // Wednesday is day 2, 12:00 = 720 minutes = bucket 144 in day
    // bucketId = 2 * 288 + 144 = 720
    const tsMs = new Date('2024-01-03T12:00:00Z').getTime();
    const bucket = mapUtcToBucket(tsMs);
    expect(bucket).toBe(720);
  });

  it('should handle week wrap correctly', () => {
    // Sunday 23:59 UTC should be near bucket 2015
    const tsMs = new Date('2024-01-07T23:59:00Z').getTime();
    const bucket = mapUtcToBucket(tsMs);
    // 23:59 = 1439 minutes = bucket 287 in day
    // bucketId = 6 * 288 + 287 = 2015
    expect(bucket).toBe(2015);
  });

  it('should produce deterministic results for fixed timestamp', () => {
    const tsMs = new Date('2024-06-15T14:30:00Z').getTime();
    const bucket1 = mapUtcToBucket(tsMs);
    const bucket2 = mapUtcToBucket(tsMs);
    expect(bucket1).toBe(bucket2);
  });

  it('should handle different times of day', () => {
    // Monday 00:05
    const ts1 = new Date('2024-01-01T00:05:00Z').getTime();
    expect(mapUtcToBucket(ts1)).toBe(1);

    // Monday 00:10
    const ts2 = new Date('2024-01-01T00:10:00Z').getTime();
    expect(mapUtcToBucket(ts2)).toBe(2);

    // Monday 12:00
    const ts3 = new Date('2024-01-01T12:00:00Z').getTime();
    expect(mapUtcToBucket(ts3)).toBe(144);
  });
});

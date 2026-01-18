import { describe, it, expect } from 'vitest';
import { aggregateTimeOfDay } from './timeOfDay.js';
import { BUCKETS_PER_DAY } from './constants.js';

describe('aggregateTimeOfDay', () => {
  it('should aggregate single bucket per day', () => {
    // All Monday 00:00 buckets (bucket 0, 288, 576, 864, 1152, 1440, 1728)
    const buckets = new Map([
      [0, 1000],    // Monday 00:00
      [288, 2000],  // Tuesday 00:00
      [576, 1500],  // Wednesday 00:00
      [864, 3000],  // Thursday 00:00
      [1152, 500],  // Friday 00:00
      [1440, 2500], // Saturday 00:00
      [1728, 1800], // Sunday 00:00
    ]);

    const result = aggregateTimeOfDay(buckets, (a, b) => a + b, 0);

    // dayBucket 0 should sum all Monday 00:00 buckets
    expect(result.get(0)).toBe(12300); // 1000 + 2000 + 1500 + 3000 + 500 + 2500 + 1800
    expect(result.size).toBe(1);
  });

  it('should aggregate multiple buckets per day', () => {
    const buckets = new Map([
      [0, 100],     // Monday 00:00
      [1, 200],     // Monday 00:05
      [288, 150],   // Tuesday 00:00
      [289, 250],   // Tuesday 00:05
      [576, 120],   // Wednesday 00:00
      [577, 180],   // Wednesday 00:05
    ]);

    const result = aggregateTimeOfDay(buckets, (a, b) => a + b, 0);

    // dayBucket 0: Monday + Tuesday + Wednesday 00:00
    expect(result.get(0)).toBe(370); // 100 + 150 + 120

    // dayBucket 1: Monday + Tuesday + Wednesday 00:05
    expect(result.get(1)).toBe(630); // 200 + 250 + 180

    expect(result.size).toBe(2);
  });

  it('should handle missing days', () => {
    // Only Monday and Wednesday have data
    const buckets = new Map([
      [0, 1000],    // Monday 00:00
      [576, 2000],  // Wednesday 00:00
    ]);

    const result = aggregateTimeOfDay(buckets, (a, b) => a + b, 0);

    // dayBucket 0 should only sum Monday and Wednesday
    expect(result.get(0)).toBe(3000); // 1000 + 2000
    expect(result.size).toBe(1);
  });

  it('should work with zero values', () => {
    const buckets = new Map([
      [0, 100],
      [288, 0],     // Tuesday has zero
      [576, 200],
    ]);

    const result = aggregateTimeOfDay(buckets, (a, b) => a + b, 0);

    // Should include zero values
    expect(result.get(0)).toBe(300); // 100 + 0 + 200
  });

  it('should work with custom aggregation function', () => {
    // Test with string concatenation
    const buckets = new Map([
      [0, 'a'],
      [288, 'b'],
      [576, 'c'],
    ]);

    const result = aggregateTimeOfDay(buckets, (a, b) => a + b, '');

    expect(result.get(0)).toBe('abc');
  });

  it('should verify correct dayBucket calculation', () => {
    // Test that bucketId % 288 gives the correct dayBucket
    const buckets = new Map([
      [0, 1],       // dayBucket 0
      [287, 2],     // dayBucket 287 (last bucket of Monday)
      [288, 3],     // dayBucket 0 (first bucket of Tuesday)
      [575, 4],     // dayBucket 287 (last bucket of Tuesday)
      [576, 5],     // dayBucket 0 (first bucket of Wednesday)
    ]);

    const result = aggregateTimeOfDay(buckets, (a, b) => a + b, 0);

    // dayBucket 0 aggregates: Monday 00:00 (0), Tuesday 00:00 (288), Wednesday 00:00 (576)
    expect(result.get(0)).toBe(9); // 1 + 3 + 5

    // dayBucket 287 aggregates: Monday 23:55 (287), Tuesday 23:55 (575)
    expect(result.get(287)).toBe(6); // 2 + 4
  });

  it('should return empty map when input is empty', () => {
    const buckets = new Map<number, number>();
    const result = aggregateTimeOfDay(buckets, (a, b) => a + b, 0);
    expect(result.size).toBe(0);
  });

  it('should handle all 7 days for a single time-of-day', () => {
    const buckets = new Map([
      [0, 10],      // Monday 00:00
      [288, 20],    // Tuesday 00:00
      [576, 30],    // Wednesday 00:00
      [864, 40],    // Thursday 00:00
      [1152, 50],   // Friday 00:00
      [1440, 60],   // Saturday 00:00
      [1728, 70],   // Sunday 00:00
    ]);

    const result = aggregateTimeOfDay(buckets, (a, b) => a + b, 0);

    expect(result.get(0)).toBe(280); // Sum of all 7 days
    expect(result.size).toBe(1);
  });

  it('should work with numeric types other than integers', () => {
    const buckets = new Map([
      [0, 1.5],
      [288, 2.3],
      [576, 0.7],
    ]);

    const result = aggregateTimeOfDay(buckets, (a, b) => a + b, 0);

    expect(result.get(0)).toBeCloseTo(4.5, 5);
  });
});

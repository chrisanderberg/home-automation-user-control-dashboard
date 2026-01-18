import { BUCKETS_PER_DAY } from './constants.js';

/**
 * Aggregates time-of-week buckets into time-of-day buckets.
 *
 * For each time-of-day bucket (0-287), sums the 7 corresponding time-of-week buckets
 * (one from each day of the week). This produces a time-of-day profile by aggregating
 * across all days.
 *
 * @param buckets - Map from bucketId (0-2015) to value
 * @param add - Function to add two values together
 * @param zero - Zero value for the type (used when a day has no data)
 * @returns Map from dayBucket (0-287) to aggregated value
 *
 * @example
 * // Aggregate milliseconds across all days
 * const weekBuckets = new Map([
 *   [0, 1000],    // Monday 00:00
 *   [288, 2000],  // Tuesday 00:00
 *   [576, 1500],  // Wednesday 00:00
 * ]);
 * const dayBuckets = aggregateTimeOfDay(
 *   weekBuckets,
 *   (a, b) => a + b,
 *   0
 * );
 * // dayBuckets.get(0) === 4500 (sum of all Monday 00:00 buckets)
 */
export function aggregateTimeOfDay<T>(
  buckets: Map<number, T>,
  add: (a: T, b: T) => T,
  zero: T,
): Map<number, T> {
  const result = new Map<number, T>();

  // For each time-of-day bucket (0-287)
  for (let dayBucket = 0; dayBucket < BUCKETS_PER_DAY; dayBucket++) {
    let aggregated: T | undefined = undefined;

    // Sum the 7 corresponding time-of-week buckets (one from each day)
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const bucketId = dayOfWeek * BUCKETS_PER_DAY + dayBucket;
      const value = buckets.get(bucketId);

      if (value !== undefined) {
        aggregated = aggregated === undefined ? value : add(aggregated, value);
      }
    }

    // Only add to result if at least one day had data
    if (aggregated !== undefined) {
      result.set(dayBucket, aggregated);
    }
  }

  return result;
}

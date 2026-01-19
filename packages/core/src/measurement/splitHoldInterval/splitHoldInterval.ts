import { mapTimestampToBucket } from '../../clocks/mapTimestamp.js';
import { BUCKET_MINUTES } from '../../time/constants.js';
import { bucketIdToDayAndMinutes } from '../../time/bucket.js';
import type { ClockConfig, ClockId } from '../../clocks/types.js';

/**
 * Parameters for splitting a holding interval across buckets.
 */
export interface SplitHoldIntervalParams {
  /** Start timestamp in milliseconds since epoch (inclusive) */
  t0Ms: number;
  /** End timestamp in milliseconds since epoch (exclusive) */
  t1Ms: number;
  /** Which clock to use for bucket mapping */
  clockId: ClockId;
  /** Clock configuration */
  config: ClockConfig;
}

/**
 * Finds the end of the current bucket for uniform clocks.
 * For clocks with uniform 5-minute buckets (UTC, local, mean solar, apparent solar).
 *
 * @param tsMs - Current timestamp
 * @param currentBucket - Current bucket ID
 * @param clockId - Clock type
 * @param config - Clock configuration
 * @param maxTime - Maximum time to search (t1Ms)
 * @returns Timestamp of bucket end, or undefined if entered undefined region
 */
function findUniformBucketEnd(
  tsMs: number,
  currentBucket: number,
  clockId: ClockId,
  config: ClockConfig,
  maxTime: number,
): number | undefined {
  // For uniform clocks, step forward to find when bucket changes
  // Use binary search-like approach: start with larger steps, then refine
  let searchTime = tsMs;
  const maxStep = BUCKET_MINUTES * 60 * 1000; // 5 minutes max
  const minStep = 1000; // 1 second minimum

  // First, try stepping by 30 seconds to find approximate boundary
  while (searchTime < maxTime && searchTime < tsMs + maxStep * 2) {
    const testTime = Math.min(searchTime + 30000, maxTime); // 30 second steps
    const testBucket = mapTimestampToBucket(clockId, testTime, config);

    if (testBucket === undefined) {
      return undefined; // Entered undefined region
    }

    if (testBucket !== currentBucket) {
      // Found approximate boundary, now refine
      return refineBucketBoundary(
        searchTime,
        testTime,
        currentBucket,
        clockId,
        config,
        maxTime,
      );
    }

    searchTime = testTime;
  }

  // If we haven't found a boundary, the bucket extends to maxTime
  return maxTime;
}

/**
 * Refines the bucket boundary by binary search between low and high timestamps.
 * Uses millisecond precision to find the exact boundary.
 */
function refineBucketBoundary(
  lowMs: number,
  highMs: number,
  currentBucket: number,
  clockId: ClockId,
  config: ClockConfig,
  maxTime: number,
): number {
  // Binary search for exact boundary with millisecond precision
  while (highMs - lowMs > 1) {
    // Millisecond precision
    const midMs = Math.floor((lowMs + highMs) / 2);
    const midBucket = mapTimestampToBucket(clockId, midMs, config);

    if (midBucket === undefined || midBucket !== currentBucket) {
      highMs = midMs;
    } else {
      lowMs = midMs;
    }
  }

  return Math.min(highMs, maxTime);
}

/**
 * Splits a holding interval [t0, t1) into per-bucket elapsed milliseconds.
 *
 * For each clock independently, this function:
 * - Splits the interval at bucket boundaries
 * - Allocates real elapsed milliseconds to each overlapped bucket
 * - Skips segments where the clock mapping is undefined
 * - Handles week wrap correctly
 *
 * @param params - Interval parameters
 * @returns Map from bucket ID to allocated milliseconds for that bucket
 */
export function splitHoldInterval(
  params: SplitHoldIntervalParams,
): Map<number, number> {
  const { t0Ms, t1Ms, clockId, config } = params;

  if (t0Ms >= t1Ms) {
    return new Map(); // Invalid interval
  }

  const result = new Map<number, number>();
  let currentTime = t0Ms;

  while (currentTime < t1Ms) {
    // Find which bucket this timestamp maps to
    const bucket = mapTimestampToBucket(clockId, currentTime, config);

    if (bucket === undefined) {
      // Clock is undefined at this time - skip forward
      // Try to find next defined time by stepping forward
      let foundDefined = false;
      let searchTime = currentTime;
      const maxSearch = t1Ms;
      const searchStep = 60000; // Search in 1-minute steps

      while (searchTime < maxSearch && searchTime < currentTime + 24 * 3600000) {
        // Limit search to 24 hours to avoid infinite loops
        searchTime += searchStep;
        const testBucket = mapTimestampToBucket(clockId, searchTime, config);
        if (testBucket !== undefined) {
          currentTime = searchTime;
          foundDefined = true;
          break;
        }
      }

      if (!foundDefined) {
        // No defined time found in remaining interval
        break;
      }
      continue;
    }

    // Find the end of this bucket (or t1, whichever comes first)
    let bucketEndTime: number | undefined;

    if (clockId === 'unequalHours') {
      // For unequal hours, bucket boundaries are variable
      // We need to find when the bucket changes by stepping forward
      bucketEndTime = findUnequalHoursBucketEnd(
        currentTime,
        bucket,
        clockId,
        config,
        t1Ms,
      );
    } else {
      // For uniform clocks, find bucket end
      bucketEndTime = findUniformBucketEnd(
        currentTime,
        bucket,
        clockId,
        config,
        t1Ms,
      );
    }

    if (bucketEndTime === undefined) {
      // Entered undefined region
      currentTime += 60000; // Skip forward 1 minute
      continue;
    }

    // Allocate milliseconds from currentTime to bucketEndTime
    const allocatedMs = bucketEndTime - currentTime;
    if (allocatedMs > 0) {
      const currentAllocated = result.get(bucket) || 0;
      result.set(bucket, currentAllocated + allocatedMs);
    }

    // Move to start of next bucket
    currentTime = bucketEndTime;
  }

  return result;
}

/**
 * Finds the end of the current unequal hours bucket.
 * Unequal hours have variable bucket lengths, so we need to step through time
 * to find when the bucket ID changes.
 *
 * @param tsMs - Current timestamp
 * @param currentBucket - Current bucket ID
 * @param clockId - Clock type (should be 'unequalHours')
 * @param config - Clock configuration
 * @param maxTime - Maximum time to search (t1Ms)
 * @returns Timestamp of bucket end, or undefined if entered undefined region
 */
function findUnequalHoursBucketEnd(
  tsMs: number,
  currentBucket: number,
  clockId: ClockId,
  config: ClockConfig,
  maxTime: number,
): number | undefined {
  // Use adaptive step sizing: start small to handle very short day/night periods
  // For unequal hours, buckets can be extremely short (e.g., 20-second day = ~0.14s per bucket)
  // Start with 1-second steps, which can handle periods as short as ~12 seconds
  let lowMs = tsMs;
  let highMs = Math.min(maxTime, tsMs + 24 * 3600000); // Limit to 24 hours
  let initialStep = 1000; // Start with 1-second steps for very short periods

  // First, find approximate boundary by stepping forward with adaptive step size
  let searchTime = tsMs;
  let foundBoundary = false;
  let consecutiveSameBucket = 0;

  while (searchTime < highMs) {
    const testTime = Math.min(searchTime + initialStep, highMs);
    const testBucket = mapTimestampToBucket(clockId, testTime, config);

    if (testBucket === undefined) {
      return undefined; // Entered undefined region
    }

    if (testBucket !== currentBucket) {
      // Found approximate boundary
      lowMs = searchTime;
      highMs = testTime;
      foundBoundary = true;
      break;
    }

    // If we've checked many times without finding a boundary, increase step size
    // This handles normal-length periods efficiently while still catching short ones
    consecutiveSameBucket++;
    if (consecutiveSameBucket > 60 && initialStep < 60000) {
      // After 60 checks (60 seconds), increase to 1-minute steps for efficiency
      initialStep = 60000;
    }

    searchTime = testTime;
  }

  if (!foundBoundary) {
    // Reached maxTime without bucket change
    return maxTime;
  }

  // Refine to millisecond precision using binary search
  return refineBucketBoundary(lowMs, highMs, currentBucket, clockId, config, maxTime);
}

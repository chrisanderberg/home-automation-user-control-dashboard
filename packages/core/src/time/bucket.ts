import {
  BUCKET_MINUTES,
  BUCKETS_PER_DAY,
  BUCKETS_PER_WEEK,
  MAX_BUCKET_ID,
  MIN_BUCKET_ID,
} from './constants.js';

/**
 * Day of week representation: Monday = 0, Sunday = 6.
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Result of converting a bucketId to day and minute information.
 */
export interface BucketDayAndMinutes {
  /** Day of week: 0 = Monday, 6 = Sunday */
  dayOfWeek: DayOfWeek;
  /** Start minute of the bucket (inclusive), 0-1435 */
  startMinute: number;
  /** End minute of the bucket (exclusive), 5-1440 */
  endMinute: number;
}

/**
 * Converts a bucket ID to day of week and minute range.
 *
 * @param bucketId - Bucket ID in range [0, 2015]
 * @returns Object with dayOfWeek (0=Monday, 6=Sunday), startMinute (inclusive), and endMinute (exclusive)
 * @throws Error if bucketId is out of range
 *
 * @example
 * bucketIdToDayAndMinutes(0) // { dayOfWeek: 0, startMinute: 0, endMinute: 5 } (Monday 00:00-00:05)
 * bucketIdToDayAndMinutes(2015) // { dayOfWeek: 6, startMinute: 1435, endMinute: 1440 } (Sunday 23:55-24:00)
 */
export function bucketIdToDayAndMinutes(
  bucketId: number,
): BucketDayAndMinutes {
  if (!Number.isInteger(bucketId) || bucketId < MIN_BUCKET_ID || bucketId > MAX_BUCKET_ID) {
    throw new Error(
      `bucketId must be an integer in range [${MIN_BUCKET_ID}, ${MAX_BUCKET_ID}], got ${bucketId}`,
    );
  }

  const dayOfWeek = Math.floor(bucketId / BUCKETS_PER_DAY) as DayOfWeek;
  const bucketInDay = bucketId % BUCKETS_PER_DAY;
  const startMinute = bucketInDay * BUCKET_MINUTES;
  const endMinute = startMinute + BUCKET_MINUTES;

  return {
    dayOfWeek,
    startMinute,
    endMinute,
  };
}

/**
 * Converts day of week and minutes into day to a bucket ID.
 *
 * @param dayOfWeek - Day of week: 0 = Monday, 6 = Sunday
 * @param minutesIntoDay - Minutes into the day, in range [0, 1439] (0 to 23:59)
 * @returns Bucket ID in range [0, 2015]
 * @throws Error if inputs are out of range
 *
 * @example
 * dayAndMinutesToBucketId(0, 0) // 0 (Monday 00:00)
 * dayAndMinutesToBucketId(6, 1435) // 2015 (Sunday 23:55)
 * dayAndMinutesToBucketId(0, 3) // 0 (Monday 00:03 rounds down to bucket 0)
 * dayAndMinutesToBucketId(0, 7) // 1 (Monday 00:07 rounds down to bucket 1)
 */
export function dayAndMinutesToBucketId(
  dayOfWeek: number,
  minutesIntoDay: number,
): number {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error(
      `dayOfWeek must be an integer in range [0, 6] (0=Monday, 6=Sunday), got ${dayOfWeek}`,
    );
  }

  if (!Number.isInteger(minutesIntoDay) || minutesIntoDay < 0 || minutesIntoDay > 1439) {
    throw new Error(
      `minutesIntoDay must be an integer in range [0, 1439] (0 to 23:59), got ${minutesIntoDay}`,
    );
  }

  const bucketInDay = Math.floor(minutesIntoDay / BUCKET_MINUTES);
  return dayOfWeek * BUCKETS_PER_DAY + bucketInDay;
}

/**
 * Computes the signed cyclic distance between two bucket IDs, considering week wrap.
 *
 * The distance represents the shortest path from bucketId1 to bucketId2 on a cyclic
 * week, where Sunday 23:55 (2015) is adjacent to Monday 00:00 (0).
 *
 * @param bucketId1 - First bucket ID
 * @param bucketId2 - Second bucket ID
 * @returns Signed distance in range [-1008, +1008]:
 *   - Positive: bucketId2 is later in the week (forward direction)
 *   - Negative: bucketId2 is earlier in the week (backward direction)
 *   - Zero: same bucket
 * @throws Error if either bucketId is out of range
 *
 * @example
 * cyclicDistance(0, 1) // 1 (forward)
 * cyclicDistance(2015, 0) // 1 (forward, wraps)
 * cyclicDistance(0, 2015) // -1 (backward, wraps)
 * cyclicDistance(100, 0) // -100 (backward)
 * cyclicDistance(0, 1008) // 1008 (half week forward)
 * cyclicDistance(0, 1009) // -1007 (half week + 1 backward, shorter path)
 */
export function cyclicDistance(bucketId1: number, bucketId2: number): number {
  if (!Number.isInteger(bucketId1) || bucketId1 < MIN_BUCKET_ID || bucketId1 > MAX_BUCKET_ID) {
    throw new Error(
      `bucketId1 must be an integer in range [${MIN_BUCKET_ID}, ${MAX_BUCKET_ID}], got ${bucketId1}`,
    );
  }

  if (!Number.isInteger(bucketId2) || bucketId2 < MIN_BUCKET_ID || bucketId2 > MAX_BUCKET_ID) {
    throw new Error(
      `bucketId2 must be an integer in range [${MIN_BUCKET_ID}, ${MAX_BUCKET_ID}], got ${bucketId2}`,
    );
  }

  if (bucketId1 === bucketId2) {
    return 0;
  }

  // Compute raw difference
  let diff = bucketId2 - bucketId1;

  // Normalize to range [-BUCKETS_PER_WEEK/2, BUCKETS_PER_WEEK/2] for shortest path
  const halfWeek = BUCKETS_PER_WEEK / 2;
  if (diff > halfWeek) {
    // Forward path is longer than half week, wrap backward
    diff = diff - BUCKETS_PER_WEEK;
  } else if (diff < -halfWeek) {
    // Backward path is longer than half week, wrap forward
    diff = diff + BUCKETS_PER_WEEK;
  }

  return diff;
}

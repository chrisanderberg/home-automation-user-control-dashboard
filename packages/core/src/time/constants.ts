/**
 * Time-of-week bucket constants.
 *
 * Time is analyzed by time of week, broken into 5-minute buckets.
 * - Each day has 288 buckets (24 hours × 12 buckets/hour)
 * - Each week has 2016 buckets (7 days × 288 buckets/day)
 */

/**
 * Number of minutes per bucket.
 */
export const BUCKET_MINUTES = 5;

/**
 * Number of buckets per day.
 */
export const BUCKETS_PER_DAY = 288;

/**
 * Number of buckets per week.
 */
export const BUCKETS_PER_WEEK = 2016;

/**
 * Minimum valid bucket ID (Monday 00:00).
 */
export const MIN_BUCKET_ID = 0;

/**
 * Maximum valid bucket ID (Sunday 23:55).
 */
export const MAX_BUCKET_ID = 2015;

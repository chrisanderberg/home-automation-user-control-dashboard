import { dayAndMinutesToBucketId } from '../time/bucket.js';

/**
 * Maps a UTC timestamp to a time-of-week bucket ID.
 *
 * @param tsMs - Timestamp in milliseconds since epoch
 * @returns Bucket ID in range [0, 2015], never undefined
 */
export function mapUtcToBucket(tsMs: number): number {
  const date = new Date(tsMs);

  // JavaScript getUTCDay() returns 0=Sunday, 1=Monday, ..., 6=Saturday
  // We need 0=Monday, 1=Tuesday, ..., 6=Sunday
  const jsDayOfWeek = date.getUTCDay();
  const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;

  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const minutesIntoDay = hours * 60 + minutes;

  return dayAndMinutesToBucketId(dayOfWeek, minutesIntoDay);
}

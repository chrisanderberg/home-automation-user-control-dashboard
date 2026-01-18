import { dayAndMinutesToBucketId } from '../time/bucket.js';
import type { ClockConfig } from './types.js';

/**
 * Maps a timestamp to a local time bucket ID using the specified timezone.
 * Handles DST transitions gracefully:
 * - During "spring forward" (missing hour): maps to the later occurrence
 * - During "fall back" (repeated hour): maps to the first occurrence
 *
 * @param tsMs - Timestamp in milliseconds since epoch
 * @param config - Clock configuration with timezone
 * @returns Bucket ID in range [0, 2015], never undefined
 */
export function mapLocalToBucket(tsMs: number, config: ClockConfig): number {
  const date = new Date(tsMs);

  // Use Intl.DateTimeFormat to get local time components in the specified timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  // Get the parts we need
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);

  // Convert weekday name to our dayOfWeek format (0=Monday, 6=Sunday)
  const weekdayMap: Record<string, number> = {
    Monday: 0,
    Tuesday: 1,
    Wednesday: 2,
    Thursday: 3,
    Friday: 4,
    Saturday: 5,
    Sunday: 6,
  };

  const dayOfWeek = weekdayMap[weekday || 'Monday'] ?? 0;
  const minutesIntoDay = hour * 60 + minute;

  return dayAndMinutesToBucketId(dayOfWeek, minutesIntoDay);
}

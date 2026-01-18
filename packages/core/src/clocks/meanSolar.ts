import { dayAndMinutesToBucketId } from '../time/bucket.js';
import type { ClockConfig } from './types.js';

/**
 * Maps a timestamp to a mean solar time bucket ID.
 * Mean solar time = UTC + longitude offset (4 minutes per degree of longitude).
 *
 * @param tsMs - Timestamp in milliseconds since epoch
 * @param config - Clock configuration with latitude and longitude
 * @returns Bucket ID in range [0, 2015], or undefined if at the poles (|latitude| === 90.0)
 */
export function mapMeanSolarToBucket(
  tsMs: number,
  config: ClockConfig,
): number | undefined {
  // Check for pole condition
  if (Math.abs(config.latitude) === 90.0) {
    return undefined;
  }

  const date = new Date(tsMs);

  // Get UTC components
  const jsDayOfWeek = date.getUTCDay();
  const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();

  // Calculate total milliseconds into the day (UTC)
  const msIntoDay =
    hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;

  // Longitude offset: 1 degree = 4 minutes = 240000 milliseconds
  // Positive longitude (east) means later local solar time
  const longitudeOffsetMs = (config.longitude / 15) * 3600000;

  // Apply offset to get mean solar time
  let meanSolarMsIntoDay = msIntoDay + longitudeOffsetMs;

  // Handle day wrap (could go negative or exceed 24 hours)
  const msPerDay = 24 * 3600000;
  let finalDayOfWeek = dayOfWeek;

  // Normalize to [0, msPerDay) range and adjust day of week
  while (meanSolarMsIntoDay < 0) {
    meanSolarMsIntoDay += msPerDay;
    finalDayOfWeek = finalDayOfWeek === 0 ? 6 : finalDayOfWeek - 1;
  }
  while (meanSolarMsIntoDay >= msPerDay) {
    meanSolarMsIntoDay -= msPerDay;
    finalDayOfWeek = finalDayOfWeek === 6 ? 0 : finalDayOfWeek + 1;
  }

  // Convert back to hours and minutes
  const meanSolarHours = Math.floor(meanSolarMsIntoDay / 3600000);
  const meanSolarMinutes = Math.floor((meanSolarMsIntoDay % 3600000) / 60000);
  const minutesIntoDay = meanSolarHours * 60 + meanSolarMinutes;

  return dayAndMinutesToBucketId(finalDayOfWeek, minutesIntoDay);
}

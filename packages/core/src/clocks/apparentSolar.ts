import { dayAndMinutesToBucketId } from '../time/bucket.js';
import { mapMeanSolarToBucket } from './meanSolar.js';
import type { ClockConfig } from './types.js';

/**
 * Computes the Equation of Time (EOT) in minutes for a given date.
 * The equation of time is the difference between apparent solar time and mean solar time.
 *
 * @param date - Date in UTC
 * @returns Equation of time in minutes (positive = sun ahead of mean sun)
 */
function equationOfTime(date: Date): number {
  // Get day of year (1..365/366)
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diffMs = date.getTime() - startOfYear.getTime();
  const oneDayMs = 1000 * 60 * 60 * 24;
  const dayOfYear = diffMs / oneDayMs + 1;

  // Get fractional hour in UTC
  const hour =
    date.getUTCHours() +
    date.getUTCMinutes() / 60 +
    date.getUTCSeconds() / 3600;

  // Compute 'y' (fractional year in radians)
  const y = (2 * Math.PI / 365) * (dayOfYear - 1 + (hour - 12) / 24);

  // NOAA formula for equation of time (in minutes)
  const eqtime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(y) -
      0.032077 * Math.sin(y) -
      0.014615 * Math.cos(2 * y) -
      0.040849 * Math.sin(2 * y));

  return eqtime;
}

/**
 * Maps a timestamp to an apparent solar time bucket ID.
 * Apparent solar time = mean solar time + equation of time adjustment.
 *
 * @param tsMs - Timestamp in milliseconds since epoch
 * @param config - Clock configuration with latitude and longitude
 * @returns Bucket ID in range [0, 2015], or undefined if at the poles (|latitude| === 90.0)
 */
export function mapApparentSolarToBucket(
  tsMs: number,
  config: ClockConfig,
): number | undefined {
  // Check for pole condition (mean solar will also check, but be explicit)
  if (Math.abs(config.latitude) === 90.0) {
    return undefined;
  }

  // Get mean solar bucket first
  const meanSolarBucket = mapMeanSolarToBucket(tsMs, config);
  if (meanSolarBucket === undefined) {
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

  // Longitude offset for mean solar
  const longitudeOffsetMs = (config.longitude / 15) * 3600000;

  // Mean solar time in milliseconds into day
  let meanSolarMsIntoDay = msIntoDay + longitudeOffsetMs;

  // Normalize to [0, msPerDay)
  const msPerDay = 24 * 3600000;
  let finalDayOfWeek = dayOfWeek;
  while (meanSolarMsIntoDay < 0) {
    meanSolarMsIntoDay += msPerDay;
    finalDayOfWeek = finalDayOfWeek === 0 ? 6 : finalDayOfWeek - 1;
  }
  while (meanSolarMsIntoDay >= msPerDay) {
    meanSolarMsIntoDay -= msPerDay;
    finalDayOfWeek = finalDayOfWeek === 6 ? 0 : finalDayOfWeek + 1;
  }

  // Get equation of time in minutes, convert to milliseconds
  const eqTimeMinutes = equationOfTime(date);
  const eqTimeMs = eqTimeMinutes * 60000;

  // Apply equation of time to get apparent solar time
  let apparentSolarMsIntoDay = meanSolarMsIntoDay + eqTimeMs;

  // Normalize again (equation of time can push us across day boundaries)
  while (apparentSolarMsIntoDay < 0) {
    apparentSolarMsIntoDay += msPerDay;
    finalDayOfWeek = finalDayOfWeek === 0 ? 6 : finalDayOfWeek - 1;
  }
  while (apparentSolarMsIntoDay >= msPerDay) {
    apparentSolarMsIntoDay -= msPerDay;
    finalDayOfWeek = finalDayOfWeek === 6 ? 0 : finalDayOfWeek + 1;
  }

  // Convert to hours and minutes
  const apparentSolarHours = Math.floor(apparentSolarMsIntoDay / 3600000);
  const apparentSolarMinutes = Math.floor(
    (apparentSolarMsIntoDay % 3600000) / 60000,
  );
  const minutesIntoDay = apparentSolarHours * 60 + apparentSolarMinutes;

  return dayAndMinutesToBucketId(finalDayOfWeek, minutesIntoDay);
}

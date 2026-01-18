import { dayAndMinutesToBucketId } from '../time/bucket.js';
import { getTimes } from './suncalc-wrapper.js';
import type { ClockConfig } from './types.js';

/**
 * Maps a timestamp to an unequal hours (temporal hours) bucket ID.
 * Unequal hours: 6:00 a.m. is always sunrise, 6:00 p.m. is always sunset.
 * The daylight interval (sunrise→sunset) is mapped to 12 equal "day hours".
 * The night interval (sunset→next sunrise) is mapped to 12 equal "night hours".
 *
 * @param tsMs - Timestamp in milliseconds since epoch
 * @param config - Clock configuration with latitude and longitude
 * @returns Bucket ID in range [0, 2015], or undefined if sunrise/sunset unavailable (polar day/night)
 */
export function mapUnequalHoursToBucket(
  tsMs: number,
  config: ClockConfig,
): number | undefined {
  const date = new Date(tsMs);

  // Get sunrise and sunset for this date
  const times = getTimes(date, config.latitude, config.longitude);

  // If sunrise or sunset is null, we're in polar day/night
  if (!times.sunrise || !times.sunset) {
    return undefined;
  }

  const sunriseMs = times.sunrise.getTime();
  const sunsetMs = times.sunset.getTime();

  // Get next sunrise (for night period calculation)
  const nextDay = new Date(date);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const nextTimes = getTimes(nextDay, config.latitude, config.longitude);
  const nextSunriseMs = nextTimes.sunrise?.getTime();

  if (!nextSunriseMs) {
    return undefined;
  }

  // Determine if we're in day period or night period
  const isDayPeriod = tsMs >= sunriseMs && tsMs < sunsetMs;
  const isNightPeriod = tsMs >= sunsetMs && tsMs < nextSunriseMs;

  if (!isDayPeriod && !isNightPeriod) {
    // Before sunrise today - we're in the night period from previous sunset to current sunrise
    const prevDay = new Date(date);
    prevDay.setUTCDate(prevDay.getUTCDate() - 1);
    const prevTimes = getTimes(prevDay, config.latitude, config.longitude);
    const prevSunsetMs = prevTimes.sunset?.getTime();
    const prevSunriseMs = times.sunrise?.getTime();

    if (!prevSunsetMs || !prevSunriseMs) {
      return undefined;
    }

    // We're in the night period from previous sunset to current sunrise
    const nightStartMs = prevSunsetMs;
    const nightEndMs = prevSunriseMs;
    const nightDurationMs = nightEndMs - nightStartMs;

    // Position in night period (0 = previous sunset, 1 = current sunrise)
    const positionInNight = (tsMs - nightStartMs) / nightDurationMs;

    // In unequal hours, night period is 18:00 (6:00 PM) to 6:00 (next day)
    // The night period spans two calendar days:
    // - First half: 18:00-24:00 of previous day (1080-1440 minutes)
    // - Second half: 0:00-6:00 of current day (0-360 minutes)
    // Since we're before sunrise, we're in the second half (0:00-6:00 of current day)
    // Map the second half of the night (position > 0.5) to 0:00-6:00
    // But since we're before sunrise, position should be > 0.5 (we're in the latter part of night)
    // Actually, we need to map the full night to 18:00-6:00, so:
    // - If position < 0.5: we're in 18:00-24:00 of previous day
    // - If position >= 0.5: we're in 0:00-6:00 of current day
    
    if (positionInNight < 0.5) {
      // First half of night: 18:00-24:00 of previous day (1080-1440 minutes)
      const positionInFirstHalf = positionInNight * 2; // 0-1 in first half
      const minutesIntoDay = Math.floor(1080 + positionInFirstHalf * 360);
      const prevDayDate = new Date(prevSunsetMs);
      const jsDayOfWeek = prevDayDate.getUTCDay();
      const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
      return dayAndMinutesToBucketId(dayOfWeek, minutesIntoDay);
    } else {
      // Second half of night: 0:00-6:00 of current day (0-360 minutes)
      const positionInSecondHalf = (positionInNight - 0.5) * 2; // 0-1 in second half
      const minutesIntoDay = Math.floor(positionInSecondHalf * 360);
      const jsDayOfWeek = date.getUTCDay();
      const dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
      return dayAndMinutesToBucketId(dayOfWeek, minutesIntoDay);
    }
  }

  let minutesIntoDay: number;
  let dayOfWeek: number;

  if (isDayPeriod) {
    // Day period: sunrise to sunset, mapped to 6:00 to 18:00 (360 to 1080 minutes)
    const dayDurationMs = sunsetMs - sunriseMs;
    const positionInDay = (tsMs - sunriseMs) / dayDurationMs;

    // Map position [0, 1] in day to [360, 1080] minutes (6:00 to 18:00)
    minutesIntoDay = Math.floor(360 + positionInDay * 720);

    const jsDayOfWeek = date.getUTCDay();
    dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
  } else {
    // Night period: sunset to next sunrise, mapped to 18:00 to 6:00 next day
    const nightDurationMs = nextSunriseMs - sunsetMs;
    const positionInNight = (tsMs - sunsetMs) / nightDurationMs;

    // In unequal hours, night is 18:00 (1080 min) to 6:00 next day (360 min)
    // For the current day: map to 18:00-24:00 (1080-1440)
    // If position > 0.5, we're past midnight, so use next day's 0:00-6:00 (0-360)
    if (positionInNight < 0.5) {
      // First half of night: 18:00 to 24:00 (1080 to 1440)
      minutesIntoDay = Math.floor(1080 + positionInNight * 2 * 360);
      const jsDayOfWeek = date.getUTCDay();
      dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
    } else {
      // Second half of night: 0:00 to 6:00 next day (0 to 360)
      const positionInSecondHalf = (positionInNight - 0.5) * 2;
      minutesIntoDay = Math.floor(positionInSecondHalf * 360);
      const nextDayDate = new Date(nextSunriseMs);
      const jsDayOfWeek = nextDayDate.getUTCDay();
      dayOfWeek = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
    }
  }

  return dayAndMinutesToBucketId(dayOfWeek, minutesIntoDay);
}

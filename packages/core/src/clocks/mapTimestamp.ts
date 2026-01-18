import { mapApparentSolarToBucket } from './apparentSolar.js';
import { mapLocalToBucket } from './local.js';
import { mapMeanSolarToBucket } from './meanSolar.js';
import { mapUnequalHoursToBucket } from './unequalHours.js';
import { mapUtcToBucket } from './utc.js';
import type { ClockConfig, ClockId } from './types.js';

/**
 * Maps a timestamp to a time-of-week bucket ID for the specified clock.
 *
 * @param clockId - Which clock to use for mapping
 * @param tsMs - Timestamp in milliseconds since epoch
 * @param config - Clock configuration (timezone, latitude, longitude)
 * @returns Bucket ID in range [0, 2015], or undefined if clock time-of-day is undefined
 *          (e.g., solar clocks at poles, unequal hours during polar day/night)
 */
export function mapTimestampToBucket(
  clockId: ClockId,
  tsMs: number,
  config: ClockConfig,
): number | undefined {
  switch (clockId) {
    case 'utc':
      return mapUtcToBucket(tsMs);
    case 'local':
      return mapLocalToBucket(tsMs, config);
    case 'meanSolar':
      return mapMeanSolarToBucket(tsMs, config);
    case 'apparentSolar':
      return mapApparentSolarToBucket(tsMs, config);
    case 'unequalHours':
      return mapUnequalHoursToBucket(tsMs, config);
    default:
      // Exhaustive check - TypeScript will error if a ClockId is missing
      const _exhaustive: never = clockId;
      throw new Error(`Unknown clock ID: ${_exhaustive}`);
  }
}

/**
 * Clock identifier for the five different time representations.
 */
export type ClockId =
  | 'local'
  | 'utc'
  | 'meanSolar'
  | 'apparentSolar'
  | 'unequalHours';

/**
 * Configuration required for clock mappings.
 */
export interface ClockConfig {
  /** IANA timezone string (e.g., "America/New_York") */
  timezone: string;
  /** Latitude in degrees, range [-90, 90] */
  latitude: number;
  /** Longitude in degrees, range [-180, 180] */
  longitude: number;
}

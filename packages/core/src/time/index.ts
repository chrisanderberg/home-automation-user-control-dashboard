/**
 * Time-of-week bucket indexing utilities.
 *
 * This module provides clock-agnostic utilities for working with time-of-week buckets:
 * - Constants for bucket sizes
 * - Conversion between bucket IDs and day/minute representations
 * - Cyclic distance calculations (for week wrap)
 * - Time-of-day aggregation helpers
 */

export * from './constants.js';
export * from './bucket.js';
export * from './timeOfDay.js';

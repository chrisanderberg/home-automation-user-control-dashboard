/**
 * Core domain logic for home automation user control dashboard.
 * This package contains pure TypeScript logic with no framework dependencies.
 */

/**
 * Trivial export for smoke testing.
 */
export function hello(): string {
  return 'Hello from core';
}

/**
 * Re-export all domain types, validation schemas, and utilities.
 */
export * from './domain/index.js';

/**
 * Re-export all time-of-week bucket indexing utilities.
 */
export * from './time/index.js';

/**
 * Re-export all clock mapping utilities.
 */
export * from './clocks/index.js';

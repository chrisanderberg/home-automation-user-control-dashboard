/**
 * Dense array index math utilities for analytics data storage.
 * 
 * Implements the canonical index math from MANUAL.md for accessing
 * dense numerical arrays storing holding times and transition counts.
 * 
 * Array layout per (control, model, window):
 * - Total size: N² × G where N = numStates, G = 10080 (2016 buckets × 5 clocks)
 * - Holding times: N × G values (one group per state)
 * - Transition counts: N × (N-1) × G values (one group per transition pair)
 */

import { BUCKETS_PER_WEEK } from '../../time/constants.js';

/**
 * Constants for dense array layout.
 */
export { BUCKETS_PER_WEEK }; // Re-export for convenience
export const NUM_CLOCKS = 5;
export const VALUES_PER_BUCKET_GROUP = BUCKETS_PER_WEEK * NUM_CLOCKS; // G = 10080

/**
 * Clock index mapping (canonical ordering from MANUAL.md).
 */
export const CLOCK_INDICES = {
  utc: 0,
  local: 1,
  meanSolar: 2,
  apparentSolar: 3,
  unequalHours: 4,
} as const;

export type ClockIndex = 0 | 1 | 2 | 3 | 4;

/**
 * Calculate the total array size for a control with N states.
 * 
 * @param numStates - Number of discrete states (N)
 * @returns Total number of values: N² × G
 */
export function getArraySize(numStates: number): number {
  return numStates * numStates * VALUES_PER_BUCKET_GROUP;
}

/**
 * Calculate the index for a holding time value.
 * 
 * @param state - State index s ∈ [0, N-1]
 * @param clock - Clock index c ∈ [0, 4]
 * @param bucket - Bucket index b ∈ [0, 2015]
 * @returns Array index: (s × G) + (c × B) + b
 */
export function holdIndex(
  state: number,
  clock: ClockIndex,
  bucket: number,
): number {
  return (
    state * VALUES_PER_BUCKET_GROUP +
    clock * BUCKETS_PER_WEEK +
    bucket
  );
}

/**
 * Calculate the offset within a from-state block for a transition.
 * 
 * @param from - Source state index
 * @param to - Destination state index
 * @returns Offset: to if to < from, else to - 1
 */
function offsetWithinFromBlock(from: number, to: number): number {
  if (to < from) {
    return to;
  } else {
    return to - 1;
  }
}

/**
 * Calculate the transition group index for a (from, to) pair.
 * 
 * @param from - Source state index ∈ [0, N-1]
 * @param to - Destination state index ∈ [0, N-1], to != from
 * @param numStates - Total number of states (N)
 * @returns Group index: (from × (N - 1)) + offsetWithinFromBlock(from, to)
 */
export function transGroupIndex(
  from: number,
  to: number,
  numStates: number,
): number {
  if (from === to) {
    throw new Error('Self-transitions (i → i) are not stored');
  }
  if (from < 0 || from >= numStates || to < 0 || to >= numStates) {
    throw new Error(
      `Invalid state indices: from=${from}, to=${to}, numStates=${numStates}`,
    );
  }

  const offset = offsetWithinFromBlock(from, to);
  return from * (numStates - 1) + offset;
}

/**
 * Calculate the index for a transition count value.
 * 
 * @param from - Source state index ∈ [0, N-1]
 * @param to - Destination state index ∈ [0, N-1], to != from
 * @param clock - Clock index c ∈ [0, 4]
 * @param bucket - Bucket index b ∈ [0, 2015]
 * @param numStates - Total number of states (N)
 * @returns Array index: (N × G) + (transGroupIndex(from, to) × G) + (c × B) + b
 */
export function transIndex(
  from: number,
  to: number,
  clock: ClockIndex,
  bucket: number,
  numStates: number,
): number {
  const groupIndex = transGroupIndex(from, to, numStates);
  const holdingTimeSectionSize = numStates * VALUES_PER_BUCKET_GROUP;
  return (
    holdingTimeSectionSize +
    groupIndex * VALUES_PER_BUCKET_GROUP +
    clock * BUCKETS_PER_WEEK +
    bucket
  );
}

/**
 * Create a new dense array initialized to zeros.
 * 
 * @param numStates - Number of discrete states (N)
 * @returns Array of N² × G zeros
 */
export function createDenseArray(numStates: number): number[] {
  const size = getArraySize(numStates);
  return new Array(size).fill(0);
}

/**
 * Validate that an array has the correct size for the given number of states.
 * 
 * @param array - Array to validate
 * @param numStates - Expected number of states
 * @returns true if array size matches expected size
 */
export function validateArraySize(array: number[], numStates: number): boolean {
  const expectedSize = getArraySize(numStates);
  return array.length === expectedSize;
}

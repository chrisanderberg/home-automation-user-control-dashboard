/**
 * Slider discretization logic.
 * Maps continuous slider values [0, 1] to discrete analytics states [0, 5].
 */

import type { SliderValue01 } from './types.js';

/**
 * Policy for handling boundary values (0.25, 0.5, 0.75) when discretizing sliders.
 */
export type SliderBoundaryPolicy =
  | 'roundDown'
  | 'roundUp'
  | 'roundNearest'
  | 'roundNearestTiesUp';

/**
 * Default boundary policy: round to nearest (ties go to lower state).
 * This matches the user's initial preference from setup.
 */
export const DEFAULT_SLIDER_BOUNDARY_POLICY: SliderBoundaryPolicy = 'roundNearest';

/**
 * Discretizes a continuous slider value [0, 1] into a discrete state [0, 5].
 *
 * Mapping rules:
 * - 0 → state 0
 * - 1 → state 5
 * - (0, 0.25) → state 1
 * - (0.25, 0.5) → state 2
 * - (0.5, 0.75) → state 3
 * - (0.75, 1) → state 4
 *
 * Boundary behavior (at exactly 0.25, 0.5, 0.75) is determined by the policy:
 * - `roundDown`: assign to lower state
 * - `roundUp`: assign to higher state
 * - `roundNearest`: round to nearest state (ties go to lower)
 * - `roundNearestTiesUp`: round to nearest state (ties go to higher)
 *
 * @param value01 - Continuous slider value in [0, 1]
 * @param policy - Boundary rounding policy (required, no silent defaults)
 * @returns Discrete state in [0, 5]
 */
export function discretizeSlider(
  value01: SliderValue01,
  policy: SliderBoundaryPolicy
): number {
  // Handle exact endpoints
  if (value01 === 0) {
    return 0;
  }
  if (value01 === 1) {
    return 5;
  }

  // Handle boundary values
  if (value01 === 0.25) {
    return handleBoundary(0.25, 1, 2, policy);
  }
  if (value01 === 0.5) {
    return handleBoundary(0.5, 2, 3, policy);
  }
  if (value01 === 0.75) {
    return handleBoundary(0.75, 3, 4, policy);
  }

  // Handle interior ranges
  if (value01 > 0 && value01 < 0.25) {
    return 1;
  }
  if (value01 > 0.25 && value01 < 0.5) {
    return 2;
  }
  if (value01 > 0.5 && value01 < 0.75) {
    return 3;
  }
  if (value01 > 0.75 && value01 < 1) {
    return 4;
  }

  // This should never happen if value01 is in [0, 1]
  throw new Error(`Invalid slider value: ${value01}`);
}

/**
 * Handles boundary value rounding according to the policy.
 * 
 * For boundaries:
 * - 0.25 is between state 1 (center ~0.125) and state 2 (center ~0.375)
 * - 0.5 is between state 2 (center ~0.375) and state 3 (center ~0.625)
 * - 0.75 is between state 3 (center ~0.625) and state 4 (center ~0.875)
 */
function handleBoundary(
  value: number,
  lowerState: number,
  higherState: number,
  policy: SliderBoundaryPolicy
): number {
  switch (policy) {
    case 'roundDown':
      return lowerState;
    case 'roundUp':
      return higherState;
    case 'roundNearest': {
      // Calculate centers of the two states
      const lowerCenter = getStateCenter(lowerState);
      const higherCenter = getStateCenter(higherState);
      const distToLower = Math.abs(value - lowerCenter);
      const distToHigher = Math.abs(value - higherCenter);
      if (distToLower < distToHigher) {
        return lowerState;
      } else if (distToHigher < distToLower) {
        return higherState;
      } else {
        // Tie: go to lower
        return lowerState;
      }
    }
    case 'roundNearestTiesUp': {
      // Calculate centers of the two states
      const lowerCenter = getStateCenter(lowerState);
      const higherCenter = getStateCenter(higherState);
      const distToLower = Math.abs(value - lowerCenter);
      const distToHigher = Math.abs(value - higherCenter);
      if (distToLower < distToHigher) {
        return lowerState;
      } else if (distToHigher < distToLower) {
        return higherState;
      } else {
        // Tie: go to higher
        return higherState;
      }
    }
  }
}

/**
 * Gets the center value of a discrete state for rounding calculations.
 * State 0: center at 0
 * State 1: center at 0.125 (middle of (0, 0.25))
 * State 2: center at 0.375 (middle of (0.25, 0.5))
 * State 3: center at 0.625 (middle of (0.5, 0.75))
 * State 4: center at 0.875 (middle of (0.75, 1))
 * State 5: center at 1
 */
function getStateCenter(state: number): number {
  switch (state) {
    case 0:
      return 0;
    case 1:
      return 0.125; // middle of (0, 0.25)
    case 2:
      return 0.375; // middle of (0.25, 0.5)
    case 3:
      return 0.625; // middle of (0.5, 0.75)
    case 4:
      return 0.875; // middle of (0.75, 1)
    case 5:
      return 1;
    default:
      throw new Error(`Invalid state: ${state}`);
  }
}

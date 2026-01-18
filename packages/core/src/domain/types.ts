/**
 * Core domain types for home automation controls.
 * These types represent the fundamental building blocks of the system.
 */

/**
 * Branded type for control identifiers.
 * Provides type safety to distinguish control IDs from other strings.
 */
export type ControlId = string & { readonly __brand: 'ControlId' };

/**
 * Branded type for model identifiers.
 * Provides type safety to distinguish model IDs from other strings.
 */
export type ModelId = string & { readonly __brand: 'ModelId' };

/**
 * Type of control (discriminated union discriminator).
 */
export type ControlKind = 'radiobutton' | 'slider';

/**
 * Definition for a radiobutton control.
 * A radiobutton has a finite set of labeled options (2-10 states).
 */
export interface RadiobuttonDefinition {
  readonly kind: 'radiobutton';
  /**
   * Number of states. Must be between 2 and 10 (inclusive).
   */
  readonly numStates: number;
  /**
   * Labels for each state. Must have exactly numStates elements.
   * Labels are indexed by state (0..numStates-1).
   */
  readonly labels: readonly string[];
}

/**
 * Definition for a slider control.
 * A slider is continuous in the UI but discretized into 6 states (0..5) for analytics.
 */
export interface SliderDefinition {
  readonly kind: 'slider';
  /**
   * Optional labels for the 6 discrete states.
   * If provided, must have exactly 6 elements (indexed 0..5).
   */
  readonly labels?: readonly string[];
}

/**
 * Control definition (discriminated union).
 * Each control must be either a radiobutton or a slider.
 */
export type ControlDefinition = RadiobuttonDefinition | SliderDefinition;

/**
 * Discrete state value.
 * For radiobuttons: integer in [0, numStates-1]
 * For sliders: integer in [0, 5]
 */
export type DiscreteState = number;

/**
 * Branded type for slider continuous values.
 * Represents a value in the continuous range [0, 1].
 * This is the canonical value stored in runtime for sliders.
 */
export type SliderValue01 = number & { readonly __brand: 'SliderValue01' };

/**
 * Type guard to check if a value is a valid SliderValue01.
 */
export function isSliderValue01(value: number): value is SliderValue01 {
  return value >= 0 && value <= 1;
}

/**
 * Creates a SliderValue01 from a number, throwing if out of range.
 */
export function createSliderValue01(value: number): SliderValue01 {
  if (value < 0 || value > 1) {
    throw new Error(`SliderValue01 must be in [0, 1], got ${value}`);
  }
  return value as SliderValue01;
}

/**
 * Domain module public exports.
 * This module contains all core domain types, validation, and utilities.
 */

// Types
export type {
  ControlId,
  ModelId,
  ControlKind,
  ControlDefinition,
  RadiobuttonDefinition,
  SliderDefinition,
  DiscreteState,
  SliderValue01,
} from './types.js';

export {
  isSliderValue01,
  createSliderValue01,
} from './types.js';

// Slider discretization
export type { SliderBoundaryPolicy } from './slider.js';
export {
  DEFAULT_SLIDER_BOUNDARY_POLICY,
  discretizeSlider,
} from './slider.js';

// Validation schemas
export {
  controlIdSchema,
  modelIdSchema,
  sliderValue01Schema,
  radiobuttonDefinitionSchema,
  sliderDefinitionSchema,
  controlDefinitionSchema,
  discreteStateSchema,
} from './validation.js';

// API shapes
export type { SetControlValueRequest } from './api.js';
export { setControlValueRequestSchema } from './api.js';

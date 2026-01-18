/**
 * Zod validation schemas for domain types.
 */

import { z } from 'zod';
import type {
  ControlId,
  ModelId,
  ControlDefinition,
  RadiobuttonDefinition,
  SliderDefinition,
  SliderValue01,
} from './types.js';
import { createSliderValue01 } from './types.js';

/**
 * Schema for ControlId (non-empty string).
 */
export const controlIdSchema = z.string().min(1) as z.ZodType<ControlId>;

/**
 * Schema for ModelId (non-empty string).
 */
export const modelIdSchema = z.string().min(1) as z.ZodType<ModelId>;

/**
 * Schema for SliderValue01 (number in [0, 1]).
 */
export const sliderValue01Schema = z
  .number()
  .min(0)
  .max(1)
  .transform((val) => createSliderValue01(val)) as z.ZodType<SliderValue01>;

/**
 * Base schema for RadiobuttonDefinition (without refine).
 * This is used by discriminatedUnion which cannot see through ZodEffects wrappers.
 */
const radiobuttonDefinitionSchemaBase = z.object({
  kind: z.literal('radiobutton'),
  numStates: z.number().int().min(2).max(10),
  labels: z.array(z.string()),
});

/**
 * Schema for RadiobuttonDefinition.
 * Validates that numStates is between 2 and 10, and labels match numStates.
 */
export const radiobuttonDefinitionSchema = radiobuttonDefinitionSchemaBase.refine(
  (data) => data.labels.length === data.numStates,
  {
    message: 'labels array must have exactly numStates elements',
    path: ['labels'],
  }
);

/**
 * Schema for SliderDefinition.
 * Validates optional labels (if provided, must have exactly 6 elements).
 */
export const sliderDefinitionSchema = z.object({
  kind: z.literal('slider'),
  labels: z
    .array(z.string())
    .length(6)
    .optional(),
});

/**
 * Schema for ControlDefinition (discriminated union).
 * Uses the base schema for radiobutton (without refine) so discriminatedUnion can access the kind property.
 * The refine validation is applied after the union.
 */
export const controlDefinitionSchema = z.discriminatedUnion('kind', [
  radiobuttonDefinitionSchemaBase,
  sliderDefinitionSchema,
]).refine(
  (data) => {
    if (data.kind === 'radiobutton') {
      return data.labels.length === data.numStates;
    }
    return true;
  },
  {
    message: 'labels array must have exactly numStates elements',
    path: ['labels'],
  }
);

/**
 * Creates a schema for validating discrete states given a control definition.
 * 
 * @param definition - The control definition to validate against
 * @returns A Zod schema that validates discrete states for this control
 */
export function discreteStateSchema(
  definition: ControlDefinition
): z.ZodNumber {
  if (definition.kind === 'radiobutton') {
    return z
      .number()
      .int()
      .min(0)
      .max(definition.numStates - 1);
  } else {
    // Slider: states 0..5
    return z.number().int().min(0).max(5);
  }
}

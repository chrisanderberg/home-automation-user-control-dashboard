/**
 * API input shapes for control value updates.
 * These types are used by Convex mutations to set control values.
 */

import { z } from 'zod';
import type { ControlId, SliderValue01 } from './types.js';
import { controlIdSchema, sliderValue01Schema } from './validation.js';

/**
 * Discriminated union for "set value" requests.
 * 
 * Common fields:
 * - controlId: identifier of the control
 * - initiator: whether the change is user-initiated or model-initiated
 * - isCommitted: whether this is a committed change (for debounced analytics)
 * 
 * Kind-specific fields:
 * - radiobutton: newState (discrete state)
 * - slider: newValue01 (continuous value in [0, 1])
 */
export type SetControlValueRequest =
  | {
      controlId: ControlId;
      initiator: 'user' | 'model';
      isCommitted: boolean;
      kind: 'radiobutton';
      newState: number;
    }
  | {
      controlId: ControlId;
      initiator: 'user' | 'model';
      isCommitted: boolean;
      kind: 'slider';
      newValue01: SliderValue01;
    };

/**
 * Zod schema for SetControlValueRequest (discriminated union).
 */
export const setControlValueRequestSchema: z.ZodType<SetControlValueRequest> = z.discriminatedUnion(
  'kind',
  [
    z.object({
      controlId: controlIdSchema,
      initiator: z.enum(['user', 'model']),
      isCommitted: z.boolean(),
      kind: z.literal('radiobutton'),
      newState: z.number().int().min(0),
    }),
    z.object({
      controlId: controlIdSchema,
      initiator: z.enum(['user', 'model']),
      isCommitted: z.boolean(),
      kind: z.literal('slider'),
      newValue01: sliderValue01Schema,
    }),
  ]
);

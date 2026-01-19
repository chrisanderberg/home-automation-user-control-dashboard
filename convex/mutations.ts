/**
 * Convex mutations for home automation user control dashboard.
 * 
 * This module implements Milestone 7: Config, Control Management, Set Value
 * (Committed vs Uncommitted).
 */

import { mutation } from './_generated/server.js';
import { v } from 'convex/values';
import type {
  ControlDefinition,
  SetControlValueRequest,
} from '@home-automation/core';
import {
  controlDefinitionSchema,
  discreteStateSchema,
  setControlValueRequestSchema,
  discretizeSlider,
} from '@home-automation/core';
import type { SliderBoundaryPolicy } from '@home-automation/core';

/**
 * Slider boundary policy validator (matches schema.ts).
 */
const sliderBoundaryPolicyValidator = v.union(
  v.literal('roundDown'),
  v.literal('roundUp'),
  v.literal('roundNearest'),
  v.literal('roundNearestTiesUp')
);

/**
 * Set or update global configuration (singleton pattern).
 * 
 * If a config row already exists, it will be updated with the provided fields.
 * If no config exists, a new row will be created.
 * 
 * Required fields: timezone, latitude, longitude
 * All other fields are optional and will be merged with existing values.
 */
export const setConfig = mutation({
  args: v.object({
    timezone: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    kdeBandwidth: v.optional(v.number()),
    kdeKernel: v.optional(v.string()),
    sliderBoundaryPolicy: v.optional(sliderBoundaryPolicyValidator),
    markovDampingAlpha: v.optional(v.number()),
    markovTeleportPrior: v.optional(v.string()),
    ctmcEstimatorConfig: v.optional(v.any()),
    retentionConfig: v.optional(v.any()),
  }),
  handler: async (ctx, args) => {
    // Query for existing config (singleton pattern)
    const existingConfig = await ctx.db
      .query('config')
      .first();

    const configData = {
      timezone: args.timezone,
      latitude: args.latitude,
      longitude: args.longitude,
      ...(args.kdeBandwidth !== undefined && { kdeBandwidth: args.kdeBandwidth }),
      ...(args.kdeKernel !== undefined && { kdeKernel: args.kdeKernel }),
      ...(args.sliderBoundaryPolicy !== undefined && {
        sliderBoundaryPolicy: args.sliderBoundaryPolicy,
      }),
      ...(args.markovDampingAlpha !== undefined && {
        markovDampingAlpha: args.markovDampingAlpha,
      }),
      ...(args.markovTeleportPrior !== undefined && {
        markovTeleportPrior: args.markovTeleportPrior,
      }),
      ...(args.ctmcEstimatorConfig !== undefined && {
        ctmcEstimatorConfig: args.ctmcEstimatorConfig,
      }),
      ...(args.retentionConfig !== undefined && {
        retentionConfig: args.retentionConfig,
      }),
    };

    if (existingConfig) {
      // Update existing config
      await ctx.db.patch(existingConfig._id, configData);
      return { success: true, updated: true };
    } else {
      // Insert new config
      await ctx.db.insert('config', configData);
      return { success: true, updated: false };
    }
  },
});

/**
 * Create a new control definition.
 * 
 * This mutation:
 * 1. Validates the control definition
 * 2. Creates the control definition row
 * 3. Initializes the controlRuntime row with default values
 * 
 * The control must not already exist.
 */
export const createControl = mutation({
  args: v.object({
    controlId: v.string(),
    definition: v.any(), // Will validate with Zod schema
    activeModelId: v.optional(v.string()), // Optional initial active model
  }),
  handler: async (ctx, args) => {
    // Validate definition using Zod schema
    const validationResult = controlDefinitionSchema.safeParse(args.definition);
    if (!validationResult.success) {
      throw new Error(
        `Invalid control definition: ${validationResult.error.message}`
      );
    }
    const definition = validationResult.data as ControlDefinition;

    // Check if control already exists
    const existingControl = await ctx.db
      .query('controls')
      .withIndex('by_controlId', (q) => q.eq('controlId', args.controlId))
      .first();

    if (existingControl) {
      throw new Error(`Control with id "${args.controlId}" already exists`);
    }

    // Insert control definition
    await ctx.db.insert('controls', {
      controlId: args.controlId,
      definition: definition as any, // Store validated definition
    });

    // Initialize controlRuntime row
    const nowMs = Date.now();
    const initialDiscreteState = 0;

    const runtimeData: any = {
      controlId: args.controlId,
      kind: definition.kind,
      activeModelId: args.activeModelId || '',
      currentDiscreteState: initialDiscreteState,
      lastUpdatedAtMs: nowMs,
      lastCommittedAtMs: nowMs, // Initial commit
      lastCommittedDiscreteState: initialDiscreteState,
    };

    // For sliders, add currentValue01
    if (definition.kind === 'slider') {
      runtimeData.currentValue01 = 0;
    }

    await ctx.db.insert('controlRuntime', runtimeData);

    return { success: true, controlId: args.controlId };
  },
});

/**
 * Set the active automation model for a control.
 * 
 * Updates the activeModelId field in the controlRuntime table.
 */
export const setActiveModel = mutation({
  args: v.object({
    controlId: v.string(),
    activeModelId: v.string(),
  }),
  handler: async (ctx, args) => {
    // Load controlRuntime row
    const runtime = await ctx.db
      .query('controlRuntime')
      .withIndex('by_controlId', (q) => q.eq('controlId', args.controlId))
      .first();

    if (!runtime) {
      throw new Error(`Control runtime not found for controlId: ${args.controlId}`);
    }

    // Update activeModelId
    await ctx.db.patch(runtime._id, {
      activeModelId: args.activeModelId,
    });

    return { success: true, controlId: args.controlId, activeModelId: args.activeModelId };
  },
});

/**
 * Set control value (supports both radiobutton and slider).
 * 
 * This mutation handles both committed and uncommitted updates:
 * - Uncommitted updates (isCommitted=false): Only update current state (for UI sync)
 * - Committed updates (isCommitted=true): Update current state AND create committed event
 * 
 * For sliders, the discrete state is derived from the continuous value using
 * the boundary policy from config.
 */
export const setControlValue = mutation({
  args: v.any(), // Will validate with Zod schema
  handler: async (ctx, args) => {
    // Validate payload using Zod schema
    const validationResult = setControlValueRequestSchema.safeParse(args);
    if (!validationResult.success) {
      throw new Error(
        `Invalid setControlValue request: ${validationResult.error.message}`
      );
    }
    // Cast to SetControlValueRequest (branded types are compile-time only)
    const payload = validationResult.data as unknown as SetControlValueRequest;

    // Load controlRuntime row
    const runtime = await ctx.db
      .query('controlRuntime')
      .withIndex('by_controlId', (q) => q.eq('controlId', payload.controlId))
      .first();

    if (!runtime) {
      throw new Error(
        `Control runtime not found for controlId: ${payload.controlId}`
      );
    }

    // Load control definition
    const control = await ctx.db
      .query('controls')
      .withIndex('by_controlId', (q) => q.eq('controlId', payload.controlId))
      .first();

    if (!control) {
      throw new Error(`Control not found for controlId: ${payload.controlId}`);
    }

    const definition = control.definition as ControlDefinition;

    // Verify payload kind matches control kind
    if (payload.kind !== definition.kind) {
      throw new Error(
        `Control kind mismatch: expected ${definition.kind}, got ${payload.kind}`
      );
    }

    // Compute server timestamp
    const tsMs = Date.now();

    // Update current state based on control kind
    let newDiscreteState: number;

    if (payload.kind === 'radiobutton') {
      // Validate newState
      const stateSchema = discreteStateSchema(definition);
      const stateValidation = stateSchema.safeParse(payload.newState);
      if (!stateValidation.success) {
        throw new Error(
          `Invalid radiobutton state: ${stateValidation.error.message}`
        );
      }
      newDiscreteState = payload.newState;

      // Update runtime current state
      await ctx.db.patch(runtime._id, {
        currentDiscreteState: newDiscreteState,
        lastUpdatedAtMs: tsMs,
      });
    } else {
      // Slider: validate newValue01 and derive discrete state
      if (payload.newValue01 < 0 || payload.newValue01 > 1) {
        throw new Error(
          `Invalid slider value: ${payload.newValue01} (must be in [0, 1])`
        );
      }

      // Load config to get slider boundary policy
      const config = await ctx.db.query('config').first();
      if (!config) {
        throw new Error('Config not found. Cannot discretize slider without boundary policy.');
      }

      const boundaryPolicy = config.sliderBoundaryPolicy as SliderBoundaryPolicy;
      newDiscreteState = discretizeSlider(payload.newValue01, boundaryPolicy);

      // Update runtime current state
      await ctx.db.patch(runtime._id, {
        currentValue01: payload.newValue01,
        currentDiscreteState: newDiscreteState,
        lastUpdatedAtMs: tsMs,
      });
    }

    // Handle committed state (if isCommitted === true)
    if (payload.isCommitted) {
      const fromDiscreteState = runtime.lastCommittedDiscreteState;
      const toDiscreteState = newDiscreteState;
      const activeModelId = runtime.activeModelId;

      // Insert committed change event
      await ctx.db.insert('committedChangeEvents', {
        tsMs,
        controlId: payload.controlId,
        fromDiscreteState,
        toDiscreteState,
        initiator: payload.initiator,
        activeModelId,
      });

      // Update runtime commit tracking
      await ctx.db.patch(runtime._id, {
        lastCommittedAtMs: tsMs,
        lastCommittedDiscreteState: toDiscreteState,
      });

      // TODO (Milestone 8): Trigger analytics ingestion hook here
      // The committed event will be processed to update holdMs and transCounts
    }

    return {
      success: true,
      controlId: payload.controlId,
      newDiscreteState,
      isCommitted: payload.isCommitted,
    };
  },
});

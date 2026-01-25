import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

/**
 * Convex database schema for home automation user control dashboard.
 * 
 * This schema implements Milestone 6: Config, Controls, Runtime State,
 * Event Log, and Measurement Aggregates.
 */

/**
 * Valid clock identifiers (from packages/core/src/clocks/types.ts).
 */
const clockIdValidator = v.union(
  v.literal('local'),
  v.literal('utc'),
  v.literal('meanSolar'),
  v.literal('apparentSolar'),
  v.literal('unequalHours')
);

/**
 * Slider boundary policy (from packages/core/src/domain/slider.ts).
 */
const sliderBoundaryPolicyValidator = v.union(
  v.literal('roundDown'),
  v.literal('roundUp'),
  v.literal('roundNearest'),
  v.literal('roundNearestTiesUp')
);

/**
 * Control kind discriminator (from packages/core/src/domain/types.ts).
 */
const controlKindValidator = v.union(
  v.literal('radiobutton'),
  v.literal('slider')
);

/**
 * Initiator type for change events.
 */
const initiatorValidator = v.union(
  v.literal('user'),
  v.literal('model')
);

export default defineSchema({
  /**
   * Global configuration (singleton).
   * 
   * Note: Singleton enforcement is handled in application code (mutations),
   * not in schema constraints. Only one config row should exist.
   */
  config: defineTable({
    // Location and timezone
    timezone: v.string(), // IANA timezone string (e.g., "America/New_York")
    latitude: v.number(), // Degrees, range [-90, 90]
    longitude: v.number(), // Degrees, range [-180, 180]

    // KDE (Kernel Density Estimation) parameters
    kdeBandwidth: v.optional(v.number()), // Configurable bandwidth h (TBD default)
    kdeKernel: v.optional(v.string()), // Optional kernel type (e.g., "gaussian")

    // Slider discretization boundary policy
    sliderBoundaryPolicy: v.optional(sliderBoundaryPolicyValidator),

    // Markov/CTMC stationary distribution stability parameters
    markovDampingAlpha: v.optional(v.number()), // Damping factor α in [0, 1] (configurable, TBD default)
    markovTeleportPrior: v.optional(v.string()), // Teleportation prior (e.g., "uniform" or explicit vector representation)

    // CTMC estimator configuration (placeholder for Milestone 11)
    ctmcEstimatorConfig: v.optional(v.any()),

    // Retention configuration for rolling quarters (placeholder, TBD)
    retentionConfig: v.optional(v.any()),
  }),

  /**
   * Control definitions.
   * 
   * Each control has a unique controlId and a definition that specifies
   * its kind (radiobutton or slider) and configuration.
   * 
   * The definition field stores a serialized ControlDefinition from
   * packages/core/src/domain/types.ts, validated against core domain types.
   */
  controls: defineTable({
    controlId: v.string(), // Unique control identifier
    definition: v.any(), // Serialized ControlDefinition (validated in application code)
  })
    .index('by_controlId', ['controlId']),

  /**
   * Per-control runtime state.
   * 
   * Current vs Committed semantics:
   * - "current" values (currentDiscreteState, currentValue01) may change
   *   frequently during user interaction (e.g., slider dragging)
   * - "committed" values (lastCommittedDiscreteState) are only updated when
   *   a change is committed (isCommitted=true), and these drive analytics
   * 
   * For sliders:
   * - currentValue01 is the canonical continuous value [0, 1] stored in runtime
   * - currentDiscreteState is derived from currentValue01 using the boundary policy
   * - Both are always present for sliders
   * 
   * For radiobuttons:
   * - currentDiscreteState is the current discrete state
   * - currentValue01 is not present (only for sliders)
   */
  controlRuntime: defineTable({
    controlId: v.string(),
    kind: controlKindValidator,
    activeModelId: v.string(), // ModelId - the active automation model (required per MANUAL: "exactly one model is considered the active automation model")

    // Current state (updated on every value change, committed or not)
    currentDiscreteState: v.number(), // Always present (required by MANUAL)
    lastUpdatedAtMs: v.number(), // Server timestamp when current value last changed

    // Slider-only: continuous value (canonical for slider runtime)
    currentValue01: v.optional(v.number()), // Only present when kind="slider", range [0, 1]

    // Committed state (only updated when isCommitted=true)
    // These values drive analytics (holding time and transitions)
    lastCommittedAtMs: v.number(), // Server timestamp of last committed change
    lastCommittedDiscreteState: v.number(), // Discrete state used for holds/transitions
  })
    .index('by_controlId', ['controlId']),

  /**
   * Append-only committed change event log.
   * 
   * This table stores only committed changes (isCommitted=true).
   * Uncommitted changes (e.g., intermediate slider drags) do not create events here.
   * 
   * Note: Append-only enforcement is handled in application code (mutations),
   * not in schema constraints. The schema allows updates, but mutations should
   * only insert new rows.
   */
  committedChangeEvents: defineTable({
    tsMs: v.number(), // Server timestamp when the change was committed
    controlId: v.string(),
    fromDiscreteState: v.number(), // Previous discrete state
    toDiscreteState: v.number(), // New discrete state
    initiator: initiatorValidator, // "user" or "model"
    activeModelId: v.string(), // ModelId captured at commit time (required per MANUAL: "exactly one model is considered the active automation model")
  })
    .index('by_controlId', ['controlId'])
    .index('by_tsMs', ['tsMs'])
    .index('by_controlId_tsMs', ['controlId', 'tsMs']),

  /**
   * Analytics blob metadata (without the large data array).
   * 
   * Stores metadata for aggregated sufficient statistics per (control, model, window).
   * The actual data is stored in analyticsBlobChunks to avoid exceeding Convex's 1 MiB
   * document limit.
   * 
   * Array layout (per MANUAL.md):
   * - Total size: N² × G where N = numStates, G = 10080 (2016 buckets × 5 clocks)
   * - Holding times: N × G values (one group per state)
   * - Transition counts: N × (N-1) × G values (one group per transition pair)
   * 
   * Key dimensions:
   * - controlId: which control
   * - modelId: which automation model
   * - windowId: seasonal window identifier (default: "default" for now)
   * 
   * Data structure:
   * - numStates: number of discrete states (N) for this control
   * - version: schema version for future migrations
   * 
   * Clock ordering (canonical):
   * - 0 = UTC
   * - 1 = Local time
   * - 2 = Mean solar time
   * - 3 = Apparent solar time
   * - 4 = Unequal hours
   * 
   * Note: Missing data is semantically zero (dense arrays, not sparse maps).
   */
  analyticsBlobs: defineTable({
    controlId: v.string(),
    modelId: v.string(), // ModelId
    windowId: v.string(), // Seasonal window identifier (default: "default")
    numStates: v.number(), // Number of discrete states (N) for index calculations
    version: v.number(), // Schema version for future migrations (start at 1)
  })
    .index('by_control_model_window', ['controlId', 'modelId', 'windowId']),

  /**
   * Chunks of analytics blob data.
   * 
   * Splits large dense arrays into chunks to avoid exceeding Convex's 1 MiB document limit.
   * Each chunk contains a portion of the full array data.
   * 
   * Chunks are ordered by chunkIndex and must be assembled to reconstruct the full array.
   * 
   * The batchId field enables safe atomic swaps: new chunks are inserted with a new batchId,
   * verified, and only then are old chunks (with different batchId) deleted.
   * 
   * @param controlId - Control identifier (matches analyticsBlobs)
   * @param modelId - Model identifier (matches analyticsBlobs)
   * @param windowId - Window identifier (matches analyticsBlobs)
   * @param batchId - Unique batch identifier for atomic swap operations
   * @param chunkIndex - Zero-based index of this chunk (0, 1, 2, ...)
   * @param data - Array chunk containing a portion of the full dense array
   */
  analyticsBlobChunks: defineTable({
    controlId: v.string(),
    modelId: v.string(), // ModelId
    windowId: v.string(), // Seasonal window identifier (default: "default")
    batchId: v.string(), // Unique batch identifier for atomic swap operations
    chunkIndex: v.number(), // Zero-based chunk index
    data: v.array(v.number()), // Chunk of the dense array
  })
    .index('by_control_model_window', ['controlId', 'modelId', 'windowId'])
    .index('by_control_model_window_batch', ['controlId', 'modelId', 'windowId', 'batchId'])
    .index('by_control_model_window_chunk', ['controlId', 'modelId', 'windowId', 'chunkIndex']),
});

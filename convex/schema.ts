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
    kdeBandwidth: v.number(), // Configurable bandwidth h (TBD default)
    kdeKernel: v.optional(v.string()), // Optional kernel type (e.g., "gaussian")

    // Slider discretization boundary policy
    sliderBoundaryPolicy: sliderBoundaryPolicyValidator,

    // Markov/CTMC stationary distribution stability parameters
    markovDampingAlpha: v.number(), // Damping factor α in [0, 1] (configurable, TBD default)
    markovTeleportPrior: v.string(), // Teleportation prior (e.g., "uniform" or explicit vector representation)

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
    activeModelId: v.optional(v.string()), // ModelId - the active automation model (undefined when no model is active)

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
    activeModelId: v.optional(v.string()), // ModelId captured at commit time (undefined when no model is active)
  })
    .index('by_controlId', ['controlId'])
    .index('by_tsMs', ['tsMs'])
    .index('by_controlId_tsMs', ['controlId', 'tsMs']),

  /**
   * Holding time measurement aggregates.
   * 
   * Stores accumulated milliseconds that a control spent in each state,
   * split across time-of-week buckets per clock.
   * 
   * Key dimensions:
   * - controlId: which control
   * - modelId: which automation model (or aggregated across all models)
   * - clockId: which clock (local, utc, meanSolar, apparentSolar, unequalHours)
   * - bucketId: which time-of-week bucket (0-2015, 5-minute buckets)
   * - state: which discrete state the control was in
   * 
   * Value:
   * - ms: accumulated milliseconds in this (control, model, clock, bucket, state) combination
   * 
   * Index optimization:
   * - by_controlId: single-column index for queries scoped to a control
   * - by_control_model_clock_bucket_state: composite index for exact lookups and multi-dimension queries
   * - Single-column indexes on modelId, clockId, bucketId, or state are not needed as queries
   *   always start with controlId and the composite index supports all query patterns.
   * - Before deploying, ensure tests/query logs validate no removed indexes are required.
   */
  holdMs: defineTable({
    controlId: v.string(),
    modelId: v.string(), // ModelId
    clockId: clockIdValidator,
    bucketId: v.number(), // Time-of-week bucket index [0, 2015]
    state: v.number(), // Discrete state
    ms: v.number(), // Accumulated milliseconds
  })
    .index('by_controlId', ['controlId'])
    .index('by_control_model_clock_bucket_state', [
      'controlId',
      'modelId',
      'clockId',
      'bucketId',
      'state',
    ]),

  /**
   * Transition count measurement aggregates.
   * 
   * Stores accumulated counts of user-initiated transitions between states,
   * split across time-of-week buckets per clock.
   * 
   * Key dimensions:
   * - controlId: which control
   * - modelId: which automation model (or aggregated across all models)
   * - clockId: which clock (local, utc, meanSolar, apparentSolar, unequalHours)
   * - bucketId: which time-of-week bucket (0-2015, 5-minute buckets)
   * - fromState: source discrete state
   * - toState: destination discrete state
   * 
   * Value:
   * - count: accumulated integer count of transitions in this combination
   * 
   * Note: Only user-initiated transitions are counted (initiator="user").
   * Model-initiated transitions are not recorded here.
   */
  transCounts: defineTable({
    controlId: v.string(),
    modelId: v.string(), // ModelId
    clockId: clockIdValidator,
    bucketId: v.number(), // Time-of-week bucket index [0, 2015]
    fromState: v.number(), // Source discrete state
    toState: v.number(), // Destination discrete state
    count: v.number(), // Accumulated integer count
  })
    .index('by_controlId', ['controlId'])
    .index('by_modelId', ['modelId'])
    .index('by_clockId', ['clockId'])
    .index('by_bucketId', ['bucketId'])
    .index('by_control_model_clock_bucket_from_to', [
      'controlId',
      'modelId',
      'clockId',
      'bucketId',
      'fromState',
      'toState',
    ]),
});

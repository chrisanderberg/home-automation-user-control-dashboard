/**
 * Measurement ingestion for committed change events.
 * 
 * This module implements Milestone 8: Measurement Ingestion - Update holdMs and transCounts
 * on Committed Events.
 * 
 * Processes committed change events to:
 * - Close holding intervals and split time across buckets per clock
 * - Record user-initiated transitions in transCounts
 * - Attribute all counts to the activeModelId captured at commit time
 */

import type { GenericMutationCtx } from 'convex/server';
import type { DataModel } from './_generated/dataModel.js';
import {
  splitHoldInterval,
  mapTimestampToBucket,
  type ClockId,
  type ClockConfig,
} from '@home-automation/core';

type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * All five clock identifiers that must be processed.
 */
const ALL_CLOCKS: ClockId[] = [
  'local',
  'utc',
  'meanSolar',
  'apparentSolar',
  'unequalHours',
];

/**
 * Parameters for ingesting a committed event.
 */
interface IngestionParams {
  /** The committed event that was just created */
  event: {
    tsMs: number;
    controlId: string;
    fromDiscreteState: number;
    toDiscreteState: number;
    initiator: 'user' | 'model';
    activeModelId: string;
  };
  /** Previous runtime state (before this commit) */
  prevRuntime: {
    lastCommittedAtMs: number;
    lastCommittedDiscreteState: number;
  };
}

/**
 * Ingests a committed change event to update holdMs and transCounts aggregates.
 * 
 * This function:
 * 1. Validates data integrity (discards on failure per MANUAL)
 * 2. Closes the previous holding interval [prevCommittedAtMs, currentCommittedTsMs)
 * 3. Splits holding time across all 5 clocks using splitHoldInterval
 * 4. Records user-initiated transitions (if initiator === "user")
 * 
 * All counts are attributed to the activeModelId captured at commit time.
 * 
 * @param ctx - Convex mutation context
 * @param params - Event and previous runtime state
 * @returns void (errors are logged but don't fail the mutation)
 */
export async function ingestCommittedEvent(
  ctx: MutationCtx,
  params: IngestionParams,
): Promise<void> {
  const { event, prevRuntime } = params;

  try {
    // 1. Load config (required for clock mappings)
    const config = await ctx.db.query('config').first();
    if (!config) {
      console.error(
        `[ingestCommittedEvent] Config not found. Cannot process event for controlId: ${event.controlId}`,
      );
      return; // Discard - no config means we can't map clocks
    }

    // 2. Validate integrity checks
    if (
      !validateIntegrity(event, prevRuntime)
    ) {
      console.error(
        `[ingestCommittedEvent] Integrity check failed. Discarding event for controlId: ${event.controlId}`,
      );
      return; // Discard per MANUAL: "discard bad data rather than ingest"
    }

    // Build ClockConfig from Convex config
    const clockConfig: ClockConfig = {
      timezone: config.timezone,
      latitude: config.latitude,
      longitude: config.longitude,
    };

    // 3. Close holding interval and split across clocks
    const t0Ms = prevRuntime.lastCommittedAtMs;
    const t1Ms = event.tsMs;
    const state = prevRuntime.lastCommittedDiscreteState;
    const modelId = event.activeModelId;

    // Process all clocks
    for (const clockId of ALL_CLOCKS) {
      // Split holding interval for this clock
      const bucketAllocations = splitHoldInterval({
        t0Ms,
        t1Ms,
        clockId,
        config: clockConfig,
      });

      // Upsert holdMs for each bucket
      for (const [bucketId, ms] of bucketAllocations.entries()) {
        await upsertHoldMs(ctx, {
          controlId: event.controlId,
          modelId,
          clockId,
          bucketId,
          state,
          ms,
        });
      }
    }

    // 4. Record user transitions (only if initiator === "user")
    if (event.initiator === 'user') {
      for (const clockId of ALL_CLOCKS) {
        const bucketId = mapTimestampToBucket(
          clockId,
          event.tsMs,
          clockConfig,
        );

        // Only record if bucket is defined (not undefined)
        if (bucketId !== undefined) {
          await upsertTransCounts(ctx, {
            controlId: event.controlId,
            modelId,
            clockId,
            bucketId,
            fromState: event.fromDiscreteState,
            toState: event.toDiscreteState,
          });
        }
      }
    }
  } catch (error) {
    // Log error but don't fail the mutation
    console.error(
      `[ingestCommittedEvent] Error processing event for controlId: ${event.controlId}`,
      error,
    );
  }
}

/**
 * Validates data integrity before processing.
 * Returns false if any check fails (data should be discarded).
 */
function validateIntegrity(
  event: IngestionParams['event'],
  prevRuntime: IngestionParams['prevRuntime'],
): boolean {
  // Check timestamps exist and are valid numbers
  if (
    typeof prevRuntime.lastCommittedAtMs !== 'number' ||
    typeof event.tsMs !== 'number' ||
    !isFinite(prevRuntime.lastCommittedAtMs) ||
    !isFinite(event.tsMs)
  ) {
    return false;
  }

  // Check positive interval
  if (prevRuntime.lastCommittedAtMs >= event.tsMs) {
    return false;
  }

  // Check activeModelId exists (required per schema)
  if (!event.activeModelId || typeof event.activeModelId !== 'string') {
    return false;
  }

  // Check states are valid numbers
  if (
    typeof prevRuntime.lastCommittedDiscreteState !== 'number' ||
    typeof event.fromDiscreteState !== 'number' ||
    typeof event.toDiscreteState !== 'number' ||
    !isFinite(prevRuntime.lastCommittedDiscreteState) ||
    !isFinite(event.fromDiscreteState) ||
    !isFinite(event.toDiscreteState)
  ) {
    return false;
  }

  return true;
}

/**
 * Upserts a holdMs row, incrementing existing ms or inserting new row.
 */
async function upsertHoldMs(
  ctx: MutationCtx,
  params: {
    controlId: string;
    modelId: string;
    clockId: ClockId;
    bucketId: number;
    state: number;
    ms: number;
  },
): Promise<void> {
  const { controlId, modelId, clockId, bucketId, state, ms } = params;

  // Query existing row using composite index
  const existing = await ctx.db
    .query('holdMs')
    .withIndex('by_control_model_clock_bucket_state', (q) =>
      q
        .eq('controlId', controlId)
        .eq('modelId', modelId)
        .eq('clockId', clockId)
        .eq('bucketId', bucketId)
        .eq('state', state),
    )
    .first();

  if (existing) {
    // Update existing row
    await ctx.db.patch(existing._id, { ms: existing.ms + ms });
  } else {
    // Insert new row
    await ctx.db.insert('holdMs', {
      controlId,
      modelId,
      clockId,
      bucketId,
      state,
      ms,
    });
  }
}

/**
 * Upserts a transCounts row, incrementing existing count or inserting new row.
 */
async function upsertTransCounts(
  ctx: MutationCtx,
  params: {
    controlId: string;
    modelId: string;
    clockId: ClockId;
    bucketId: number;
    fromState: number;
    toState: number;
  },
): Promise<void> {
  const { controlId, modelId, clockId, bucketId, fromState, toState } = params;

  // Query existing row using composite index
  const existing = await ctx.db
    .query('transCounts')
    .withIndex('by_control_model_clock_bucket_from_to', (q) =>
      q
        .eq('controlId', controlId)
        .eq('modelId', modelId)
        .eq('clockId', clockId)
        .eq('bucketId', bucketId)
        .eq('fromState', fromState)
        .eq('toState', toState),
    )
    .first();

  if (existing) {
    // Update existing row
    await ctx.db.patch(existing._id, { count: existing.count + 1 });
  } else {
    // Insert new row with count = 1
    await ctx.db.insert('transCounts', {
      controlId,
      modelId,
      clockId,
      bucketId,
      fromState,
      toState,
      count: 1,
    });
  }
}

/**
 * Measurement ingestion for committed change events.
 * 
 * This module implements Milestone 8: Measurement Ingestion - Update dense analytics arrays
 * on Committed Events.
 * 
 * Processes committed change events to:
 * - Close holding intervals and split time across buckets per clock
 * - Record user-initiated transitions in dense arrays
 * - Attribute all counts to the activeModelId captured at commit time
 * 
 * Uses dense numerical arrays per MANUAL.md specification instead of sparse maps.
 */

import type { GenericMutationCtx } from 'convex/server';
import type { DataModel } from './_generated/dataModel.js';
import {
  splitHoldInterval,
  mapTimestampToBucket,
  type ClockId,
  type ClockConfig,
  type ControlDefinition,
  holdIndex,
  transIndex,
  createDenseArray,
  validateArraySize,
  type ClockIndex,
} from '@home-automation/core';

type MutationCtx = GenericMutationCtx<DataModel>;

/**
 * All five clock identifiers that must be processed.
 */
const ALL_CLOCKS: ClockId[] = [
  'utc',
  'local',
  'meanSolar',
  'apparentSolar',
  'unequalHours',
];

/**
 * Map clock ID to clock index (canonical ordering from MANUAL.md).
 */
function getClockIndex(clockId: ClockId): ClockIndex {
  switch (clockId) {
    case 'utc':
      return 0;
    case 'local':
      return 1;
    case 'meanSolar':
      return 2;
    case 'apparentSolar':
      return 3;
    case 'unequalHours':
      return 4;
    default:
      throw new Error(`Unknown clock ID: ${clockId}`);
  }
}

/**
 * Get number of states from a control definition.
 */
function getNumStates(definition: ControlDefinition): number {
  if (definition.kind === 'radiobutton') {
    return definition.numStates;
  } else {
    // Slider always has 6 states
    return 6;
  }
}

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
 * Ingests a committed change event to update dense analytics arrays.
 * 
 * This function:
 * 1. Validates data integrity (discards on failure per MANUAL)
 * 2. Loads or creates the analytics blob for (control, model, window)
 * 3. Closes the previous holding interval [prevCommittedAtMs, currentCommittedTsMs)
 * 4. Splits holding time across all 5 clocks and updates dense array
 * 5. Records user-initiated transitions (if initiator === "user")
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

    // 2. Load control definition to get numStates
    const control = await ctx.db
      .query('controls')
      .withIndex('by_controlId', (q: any) => q.eq('controlId', event.controlId))
      .first();
    if (!control) {
      console.error(
        `[ingestCommittedEvent] Control not found for controlId: ${event.controlId}`,
      );
      return; // Discard
    }
    const definition = control.definition as ControlDefinition;
    const numStates = getNumStates(definition);

    // 3. Validate integrity checks
    if (!validateIntegrity(event, prevRuntime)) {
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

    // 4. Load or create analytics blob
    const windowId = 'default'; // Seasonal windows deferred
    const blob = await loadOrCreateBlob(
      ctx,
      event.controlId,
      event.activeModelId,
      windowId,
      numStates,
    );

    // 5. Close holding interval and split across clocks
    const t0Ms = prevRuntime.lastCommittedAtMs;
    const t1Ms = event.tsMs;
    const state = prevRuntime.lastCommittedDiscreteState;

    // Process all clocks
    for (const clockId of ALL_CLOCKS) {
      const clockIndex = getClockIndex(clockId);

      // Split holding interval for this clock
      const bucketAllocations = splitHoldInterval({
        t0Ms,
        t1Ms,
        clockId,
        config: clockConfig,
      });

      // Update holding times in dense array
      for (const [bucketId, ms] of bucketAllocations.entries()) {
        const index = holdIndex(state, clockIndex, bucketId);
        blob.data[index] = (blob.data[index] || 0) + ms;
      }
    }

    // 6. Record user transitions (only if initiator === "user")
    if (event.initiator === 'user') {
      for (const clockId of ALL_CLOCKS) {
        const clockIndex = getClockIndex(clockId);
        const bucketId = mapTimestampToBucket(
          clockId,
          event.tsMs,
          clockConfig,
        );

        // Only record if bucket is defined (not undefined)
        if (bucketId !== undefined) {
          const index = transIndex(
            event.fromDiscreteState,
            event.toDiscreteState,
            clockIndex,
            bucketId,
            numStates,
          );
          blob.data[index] = (blob.data[index] || 0) + 1;
        }
      }
    }

    // 7. Save updated blob
    await ctx.db.patch(blob._id, { data: blob.data });
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
 * Loads or creates an analytics blob for the given (control, model, window).
 * 
 * @param ctx - Convex mutation context
 * @param controlId - Control identifier
 * @param modelId - Model identifier
 * @param windowId - Window identifier (default: "default")
 * @param numStates - Number of discrete states (N)
 * @returns Analytics blob with dense array
 */
async function loadOrCreateBlob(
  ctx: MutationCtx,
  controlId: string,
  modelId: string,
  windowId: string,
  numStates: number,
): Promise<{
  _id: any;
  data: number[];
}> {
  // Query for existing blob
  const existing = await ctx.db
    .query('analyticsBlobs')
    .withIndex('by_control_model_window', (q: any) =>
      q
        .eq('controlId', controlId)
        .eq('modelId', modelId)
        .eq('windowId', windowId),
    )
    .first();

  if (existing) {
    // Validate array size matches expected
    if (!validateArraySize(existing.data, numStates)) {
      console.error(
        `[loadOrCreateBlob] Array size mismatch for controlId: ${controlId}, modelId: ${modelId}. Expected size for ${numStates} states, got ${existing.data.length}`,
      );
      // Create new array with correct size (data migration scenario)
      const newData = createDenseArray(numStates);
      await ctx.db.patch(existing._id, { data: newData, numStates, version: 1 });
      return { _id: existing._id, data: newData };
    }
    return { _id: existing._id, data: existing.data };
  } else {
    // Create new blob initialized to zeros
    const data = createDenseArray(numStates);
    const newBlob = await ctx.db.insert('analyticsBlobs', {
      controlId,
      modelId,
      windowId,
      numStates,
      data,
      version: 1,
    });
    return { _id: newBlob, data };
  }
}

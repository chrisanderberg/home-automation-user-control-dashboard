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
 * Chunk size for splitting large arrays to avoid Convex's 1 MiB document limit.
 * Each number is 8 bytes, so 100,000 numbers = 800,000 bytes (~0.76 MiB), safely under 1 MiB.
 */
const CHUNK_SIZE = 100000;

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

    // 7. Save updated blob (split into chunks)
    const chunks = splitIntoChunks(blob.data);
    await saveChunks(
      ctx,
      event.controlId,
      event.activeModelId,
      windowId,
      chunks,
    );
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
 * Splits a dense array into chunks.
 * 
 * @param data - Full dense array
 * @returns Array of chunks, each containing up to CHUNK_SIZE elements
 */
function splitIntoChunks(data: number[]): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

/**
 * Assembles chunks back into a full dense array.
 * 
 * @param chunks - Array of chunks in order
 * @returns Reconstructed full array
 */
function assembleFromChunks(chunks: number[][]): number[] {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) {
      result[offset + i] = chunk[i];
    }
    offset += chunk.length;
  }
  return result;
}

/**
 * Loads chunks for a blob from the database.
 * 
 * Filters by the latest batchId to ensure we only get the current valid chunks,
 * avoiding stale data during atomic swap operations.
 * 
 * @param ctx - Convex mutation context
 * @param controlId - Control identifier
 * @param modelId - Model identifier
 * @param windowId - Window identifier
 * @returns Array of chunks in order, or null if not found
 */
async function loadChunks(
  ctx: MutationCtx,
  controlId: string,
  modelId: string,
  windowId: string,
): Promise<number[][] | null> {
  // Get all chunks for this (control, model, window)
  const allChunks = await ctx.db
    .query('analyticsBlobChunks')
    .withIndex('by_control_model_window', (q: any) =>
      q
        .eq('controlId', controlId)
        .eq('modelId', modelId)
        .eq('windowId', windowId),
    )
    .collect();

  if (allChunks.length === 0) {
    return null;
  }

  // Find the latest batchId (most recent batch)
  // batchId format: "timestamp-random", so extract timestamp for comparison
  const batchIds = new Set(allChunks.map((chunk) => chunk.batchId));
  
  // Helper function to safely parse timestamp from batchId
  const parseTimestamp = (batchId: string): number => {
    const parts = batchId.split('-');
    if (parts.length === 0) return -Infinity;
    const timestamp = Number.parseInt(parts[0], 10);
    return Number.isNaN(timestamp) ? -Infinity : timestamp;
  };
  
  const batchIdsArray = Array.from(batchIds);
  if (batchIdsArray.length === 0) {
    return null;
  }
  
  const latestBatchId = batchIdsArray.reduce((latest, current) => {
    const currentTs = parseTimestamp(current);
    const latestTs = parseTimestamp(latest);
    return currentTs > latestTs ? current : latest;
  });

  // Filter to only chunks with the latest batchId
  const chunks = allChunks.filter((chunk) => chunk.batchId === latestBatchId);

  // Sort by chunkIndex to ensure correct order
  chunks.sort((a, b) => a.chunkIndex - b.chunkIndex);
  return chunks.map((chunk) => chunk.data);
}

/**
 * Saves chunks to the database, replacing any existing chunks using a safe atomic swap.
 * 
 * Uses a batchId to ensure atomicity: inserts all new chunks with a new batchId,
 * verifies insertion succeeded, then deletes old chunks with different batchId.
 * This prevents partial state if the mutation fails mid-insert.
 * 
 * @param ctx - Convex mutation context
 * @param controlId - Control identifier
 * @param modelId - Model identifier
 * @param windowId - Window identifier
 * @param chunks - Array of chunks to save
 */
async function saveChunks(
  ctx: MutationCtx,
  controlId: string,
  modelId: string,
  windowId: string,
  chunks: number[][],
): Promise<void> {
  // Generate unique batchId for this save operation
  const batchId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Insert all new chunks with the same batchId
  for (let i = 0; i < chunks.length; i++) {
    await ctx.db.insert('analyticsBlobChunks', {
      controlId,
      modelId,
      windowId,
      batchId,
      chunkIndex: i,
      data: chunks[i],
    });
  }

  // Verify the number of inserted chunks matches expected count
  const insertedChunks = await ctx.db
    .query('analyticsBlobChunks')
    .withIndex('by_control_model_window_batch', (q: any) =>
      q
        .eq('controlId', controlId)
        .eq('modelId', modelId)
        .eq('windowId', windowId)
        .eq('batchId', batchId),
    )
    .collect();

  if (insertedChunks.length !== chunks.length) {
    throw new Error(
      `Failed to insert all chunks: expected ${chunks.length}, got ${insertedChunks.length}`,
    );
  }

  // Only after successful insertion, delete old chunks that don't match the new batchId
  const existingChunks = await ctx.db
    .query('analyticsBlobChunks')
    .withIndex('by_control_model_window', (q: any) =>
      q
        .eq('controlId', controlId)
        .eq('modelId', modelId)
        .eq('windowId', windowId),
    )
    .collect();

  for (const chunk of existingChunks) {
    if (chunk.batchId !== batchId) {
      await ctx.db.delete(chunk._id);
    }
  }
}

/**
 * Loads or creates an analytics blob for the given (control, model, window).
 * 
 * @param ctx - Convex mutation context
 * @param controlId - Control identifier
 * @param modelId - Model identifier
 * @param windowId - Window identifier (default: "default")
 * @param numStates - Number of discrete states (N)
 * @returns Analytics blob metadata ID and dense array
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
  // Query for existing blob metadata
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
    // Load chunks and assemble
    const chunks = await loadChunks(ctx, controlId, modelId, windowId);
    if (chunks === null) {
      // Metadata exists but no chunks - create new chunks
      const newData = createDenseArray(numStates);
      const newChunks = splitIntoChunks(newData);
      await saveChunks(ctx, controlId, modelId, windowId, newChunks);
      return { _id: existing._id, data: newData };
    }

    const data = assembleFromChunks(chunks);
    
    // Validate array size matches expected
    if (!validateArraySize(data, numStates)) {
      console.error(
        `[loadOrCreateBlob] Array size mismatch for controlId: ${controlId}, modelId: ${modelId}. Expected size for ${numStates} states, got ${data.length}`,
      );
      // Create new array with correct size (data migration scenario)
      const newData = createDenseArray(numStates);
      const newChunks = splitIntoChunks(newData);
      await saveChunks(ctx, controlId, modelId, windowId, newChunks);
      await ctx.db.patch(existing._id, { numStates, version: 1 });
      return { _id: existing._id, data: newData };
    }
    return { _id: existing._id, data };
  } else {
    // Create new blob initialized to zeros
    const data = createDenseArray(numStates);
    const newBlob = await ctx.db.insert('analyticsBlobs', {
      controlId,
      modelId,
      windowId,
      numStates,
      version: 1,
    });
    const chunks = splitIntoChunks(data);
    await saveChunks(ctx, controlId, modelId, windowId, chunks);
    return { _id: newBlob, data };
  }
}

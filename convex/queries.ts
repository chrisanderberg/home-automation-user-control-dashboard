/**
 * Convex queries for home automation user control dashboard.
 * 
 * This module implements Milestone 9: Queries for Raw Aggregates (All Clocks) +
 * Derived Time-of-Day Views.
 * 
 * All queries return data for all 5 clocks in a single response.
 * Queries do NOT accept clockId as input - they always return all clocks.
 * 
 * Returns dense numerical arrays per MANUAL.md specification.
 */

import { query } from './_generated/server.js';
import { v } from 'convex/values';
import type { GenericQueryCtx } from 'convex/server';
import type { DataModel } from './_generated/dataModel.js';
import {
  type ClockId,
  type ControlDefinition,
  holdIndex,
  transIndex,
  BUCKETS_PER_WEEK,
  VALUES_PER_BUCKET_GROUP,
  type ClockIndex,
  BUCKETS_PER_DAY,
} from '@home-automation/core';

type QueryCtx = GenericQueryCtx<DataModel>;

/**
 * Chunk size for splitting large arrays to avoid Convex's 1 MiB document limit.
 * Must match the value in measurement.ts.
 */
const CHUNK_SIZE = 100000;

/**
 * All five clock identifiers in canonical order (matches MANUAL.md).
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
 * Gets the UTC calendar quarter from a timestamp.
 * 
 * Quarter boundaries are defined in UTC calendar time:
 * - Q1: January–March (months 0-2)
 * - Q2: April–June (months 3-5)
 * - Q3: July–September (months 6-8)
 * - Q4: October–December (months 9-11)
 * 
 * @param tsMs - Timestamp in milliseconds since epoch
 * @returns Object with year and quarter (1-4)
 */
function getUtcQuarterFromTimestamp(tsMs: number): { year: number; quarter: number } {
  const date = new Date(tsMs);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0-11
  
  // Determine quarter based on month
  let quarter: number;
  if (month >= 0 && month <= 2) {
    quarter = 1; // Q1: Jan-Mar
  } else if (month >= 3 && month <= 5) {
    quarter = 2; // Q2: Apr-Jun
  } else if (month >= 6 && month <= 8) {
    quarter = 3; // Q3: Jul-Sep
  } else {
    quarter = 4; // Q4: Oct-Dec
  }
  
  return { year, quarter };
}

/**
 * Formats a quarter window identifier as a string.
 * 
 * Format: "YYYY-Q{1-4}" (e.g., "2024-Q1")
 * 
 * @param year - UTC year
 * @param quarter - Quarter number (1-4)
 * @returns Formatted window identifier string
 */
function formatQuarterWindowId(year: number, quarter: number): string {
  return `${year}-Q${quarter}`;
}

/**
 * Gets the quarter window identifier from a timestamp.
 * 
 * @param tsMs - Timestamp in milliseconds since epoch
 * @returns Quarter window identifier string (format: "YYYY-Q{1-4}")
 */
function getQuarterWindowIdFromTimestamp(tsMs: number): string {
  const { year, quarter } = getUtcQuarterFromTimestamp(tsMs);
  return formatQuarterWindowId(year, quarter);
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
 * @param ctx - Query context
 * @param controlId - Control identifier
 * @param modelId - Model identifier
 * @param windowId - Window identifier
 * @returns Array of chunks in order, or null if not found
 */
async function loadChunks(
  ctx: QueryCtx,
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
    throw new Error("No valid batchIds found in chunks");
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
 * Load and aggregate analytics blobs for a control.
 * 
 * If modelId is provided, returns data for that model only.
 * If modelId is omitted, aggregates (sums) across all models.
 * 
 * If windowId is provided, returns data for that quarter window only.
 * If windowId is omitted, aggregates (sums) across all windowIds (for backward compatibility).
 * 
 * @param ctx - Query context
 * @param controlId - Control identifier
 * @param modelId - Optional model identifier
 * @param windowId - Optional quarter window identifier (format: "YYYY-Q{1-4}"). If omitted, aggregates across all windows.
 * @returns Aggregated dense array data
 */
async function loadAnalyticsData(
  ctx: QueryCtx,
  controlId: string,
  modelId?: string,
  windowId?: string,
): Promise<{
  numStates: number;
  data: number[];
}> {
  // Load control definition to get numStates
  const control = await ctx.db
    .query('controls')
    .withIndex('by_controlId', (q: any) => q.eq('controlId', controlId))
    .first();

  if (!control) {
    throw new Error(`Control not found: ${controlId}`);
  }

  const definition = control.definition as ControlDefinition;
  const numStates = getNumStates(definition);

  // Query analytics blob metadata for this control
  // If windowId is provided, filter by it; otherwise query all windowIds
  const allBlobs = await ctx.db
    .query('analyticsBlobs')
    .withIndex('by_control_model_window', (q: any) => {
      const query = q.eq('controlId', controlId);
      if (windowId !== undefined) {
        return query.eq('windowId', windowId);
      }
      return query;
    })
    .collect();

  // Filter by modelId if provided
  const filteredBlobs = modelId
    ? allBlobs.filter((blob) => blob.modelId === modelId)
    : allBlobs;

  if (filteredBlobs.length === 0) {
    // Return zero-filled array if no data
    const emptyData = new Array(numStates * numStates * VALUES_PER_BUCKET_GROUP).fill(0);
    return { numStates, data: emptyData };
  }

  // Aggregate (sum) across all matching blobs
  const aggregatedData = new Array(
    numStates * numStates * VALUES_PER_BUCKET_GROUP,
  ).fill(0);

  for (const blob of filteredBlobs) {
    if (blob.numStates !== numStates) {
      console.warn(
        `[loadAnalyticsData] Blob numStates mismatch: expected ${numStates}, got ${blob.numStates} for controlId: ${controlId}, modelId: ${blob.modelId}`,
      );
      continue;
    }

    // Load chunks for this blob
    const chunks = await loadChunks(ctx, blob.controlId, blob.modelId, blob.windowId);
    if (chunks === null) {
      console.warn(
        `[loadAnalyticsData] No chunks found for controlId: ${controlId}, modelId: ${blob.modelId}`,
      );
      continue;
    }

    const blobData = assembleFromChunks(chunks);
    if (blobData.length !== aggregatedData.length) {
      console.warn(
        `[loadAnalyticsData] Blob size mismatch: expected ${aggregatedData.length}, got ${blobData.length}`,
      );
      continue;
    }
    for (let i = 0; i < aggregatedData.length; i++) {
      aggregatedData[i] += blobData[i] || 0;
    }
  }

  return { numStates, data: aggregatedData };
}

/**
 * Get a control definition by controlId.
 * 
 * @param controlId - The control identifier
 * @returns The control definition, or null if not found
 */
export const getControlDefinition = query({
  // @ts-ignore - QueryBuilder type doesn't properly support args/handler syntax in this TypeScript version
  args: v.object({
    controlId: v.string(),
  }),
  handler: async (ctx: QueryCtx, args: any) => {
    const control = await ctx.db
      .query('controls')
      .withIndex('by_controlId', (q: any) => q.eq('controlId', args.controlId))
      .first();

    if (!control) {
      return null;
    }

    return {
      controlId: control.controlId,
      definition: control.definition,
    };
  },
});

/**
 * Get control runtime state by controlId.
 * 
 * @param controlId - The control identifier
 * @returns The runtime state, or null if not found
 */
export const getControlRuntime = query({
  // @ts-ignore - QueryBuilder type doesn't properly support args/handler syntax in this TypeScript version
  args: v.object({
    controlId: v.string(),
  }),
  handler: async (ctx: QueryCtx, args: any) => {
    const runtime = await ctx.db
      .query('controlRuntime')
      .withIndex('by_controlId', (q: any) => q.eq('controlId', args.controlId))
      .first();

    if (!runtime) {
      return null;
    }

    return {
      controlId: runtime.controlId,
      kind: runtime.kind,
      activeModelId: runtime.activeModelId,
      currentDiscreteState: runtime.currentDiscreteState,
      lastUpdatedAtMs: runtime.lastUpdatedAtMs,
      currentValue01: runtime.currentValue01,
      lastCommittedAtMs: runtime.lastCommittedAtMs,
      lastCommittedDiscreteState: runtime.lastCommittedDiscreteState,
    };
  },
});

/**
 * Get raw statistics (holdMs and transCounts) for a control.
 * 
 * Returns dense numerical arrays for all 5 clocks, with optional model and window filtering.
 * 
 * @param controlId - The control identifier
 * @param modelId - Optional model identifier. If provided, returns only that model's data.
 *                  If omitted, aggregates across all models.
 * @param windowId - Optional quarter window identifier (format: "YYYY-Q{1-4}", e.g., "2024-Q1").
 *                   If omitted, aggregates across all windows (for backward compatibility).
 * @param tsMs - Optional timestamp in milliseconds. If provided, computes windowId from this timestamp.
 *               If both windowId and tsMs are provided, windowId takes precedence.
 * @returns Dense arrays with metadata. Each clock has:
 *   - holdMs: array of N × 2016 values (one per state × bucket)
 *   - transCounts: array of N × (N-1) × 2016 values (one per transition × bucket)
 */
export const getRawStats = query({
  // @ts-ignore - QueryBuilder type doesn't properly support args/handler syntax in this TypeScript version
  args: v.object({
    controlId: v.string(),
    modelId: v.optional(v.string()),
    windowId: v.optional(v.string()),
    tsMs: v.optional(v.number()),
  }),
  handler: async (ctx: QueryCtx, args: any) => {
    // Determine windowId: explicit parameter takes precedence, then compute from tsMs, otherwise undefined (aggregate all)
    const windowId = args.windowId ?? (args.tsMs !== undefined ? getQuarterWindowIdFromTimestamp(args.tsMs) : undefined);
    
    // Load aggregated analytics data
    const { numStates, data } = await loadAnalyticsData(
      ctx,
      args.controlId,
      args.modelId,
      windowId,
    );

    // Extract data for each clock
    const clocks: Record<
      ClockId,
      {
        holdMs: number[][]; // [state][bucket] = milliseconds
        transCounts: number[][]; // [transitionGroup][bucket] = count
      }
    > = {
      utc: { holdMs: [], transCounts: [] },
      local: { holdMs: [], transCounts: [] },
      meanSolar: { holdMs: [], transCounts: [] },
      apparentSolar: { holdMs: [], transCounts: [] },
      unequalHours: { holdMs: [], transCounts: [] },
    };

    // Extract holding times for each clock
    for (const clockId of ALL_CLOCKS) {
      const clockIndex = getClockIndex(clockId);

      // Extract holding times: N states × 2016 buckets
      const holdMs: number[][] = [];
      for (let state = 0; state < numStates; state++) {
        const stateBuckets: number[] = [];
        for (let bucket = 0; bucket < BUCKETS_PER_WEEK; bucket++) {
          const index = holdIndex(state, clockIndex, bucket);
          stateBuckets.push(data[index] || 0);
        }
        holdMs.push(stateBuckets);
      }
      clocks[clockId].holdMs = holdMs;

      // Extract transition counts: N × (N-1) transition groups × 2016 buckets
      const transCounts: number[][] = [];
      for (let from = 0; from < numStates; from++) {
        for (let to = 0; to < numStates; to++) {
          if (from === to) continue; // Skip self-transitions

          const transitionBuckets: number[] = [];
          for (let bucket = 0; bucket < BUCKETS_PER_WEEK; bucket++) {
            const index = transIndex(from, to, clockIndex, bucket, numStates);
            transitionBuckets.push(data[index] || 0);
          }
          transCounts.push(transitionBuckets);
        }
      }
      clocks[clockId].transCounts = transCounts;
    }

    return {
      numStates,
      clocks,
      // Metadata for array access
      metadata: {
        bucketsPerWeek: BUCKETS_PER_WEEK,
        numClocks: 5,
        clockOrder: ['utc', 'local', 'meanSolar', 'apparentSolar', 'unequalHours'],
      },
    };
  },
});

/**
 * Get raw time-of-day profile derived from time-of-week buckets.
 * 
 * Aggregates time-of-week buckets (0-2015) into time-of-day buckets (0-287)
 * by summing across all 7 days of the week.
 * 
 * @param controlId - The control identifier
 * @param modelId - Optional model identifier. If provided, returns only that model's data.
 *                  If omitted, aggregates across all models.
 * @param windowId - Optional quarter window identifier (format: "YYYY-Q{1-4}", e.g., "2024-Q1").
 *                   If omitted, aggregates across all windows (for backward compatibility).
 * @param tsMs - Optional timestamp in milliseconds. If provided, computes windowId from this timestamp.
 *               If both windowId and tsMs are provided, windowId takes precedence.
 * @returns Time-of-day profile as dense arrays grouped by clock
 */
export const getRawTimeOfDayProfile = query({
  // @ts-ignore - QueryBuilder type doesn't properly support args/handler syntax in this TypeScript version
  args: v.object({
    controlId: v.string(),
    modelId: v.optional(v.string()),
    windowId: v.optional(v.string()),
    tsMs: v.optional(v.number()),
  }),
  handler: async (ctx: QueryCtx, args: any) => {
    // Determine windowId: explicit parameter takes precedence, then compute from tsMs, otherwise undefined (aggregate all)
    const windowId = args.windowId ?? (args.tsMs !== undefined ? getQuarterWindowIdFromTimestamp(args.tsMs) : undefined);
    
    // Load aggregated analytics data
    const { numStates, data } = await loadAnalyticsData(
      ctx,
      args.controlId,
      args.modelId,
      windowId,
    );

    // BUCKETS_PER_DAY imported from core

    // Build time-of-day profiles for each clock
    const clocks: Record<
      ClockId,
      {
        holdMs: number[][]; // [state][dayBucket] = milliseconds
        transCounts: number[][]; // [transitionGroup][dayBucket] = count
      }
    > = {
      utc: { holdMs: [], transCounts: [] },
      local: { holdMs: [], transCounts: [] },
      meanSolar: { holdMs: [], transCounts: [] },
      apparentSolar: { holdMs: [], transCounts: [] },
      unequalHours: { holdMs: [], transCounts: [] },
    };

    // Process each clock
    for (const clockId of ALL_CLOCKS) {
      const clockIndex = getClockIndex(clockId);

      // Aggregate holding times: sum time-of-week → time-of-day
      const holdMs: number[][] = [];
      for (let state = 0; state < numStates; state++) {
        const dayBuckets = new Array(BUCKETS_PER_DAY).fill(0);

        // For each time-of-day bucket, sum the 7 corresponding time-of-week buckets
        for (let dayBucket = 0; dayBucket < BUCKETS_PER_DAY; dayBucket++) {
          let sum = 0;
          // Sum across 7 days: dayBucket, dayBucket + 288, dayBucket + 576, etc.
          for (let day = 0; day < 7; day++) {
            const weekBucket = dayBucket + day * BUCKETS_PER_DAY;
            const index = holdIndex(state, clockIndex, weekBucket);
            sum += data[index] || 0;
          }
          dayBuckets[dayBucket] = sum;
        }
        holdMs.push(dayBuckets);
      }
      clocks[clockId].holdMs = holdMs;

      // Aggregate transition counts: sum time-of-week → time-of-day
      const transCounts: number[][] = [];
      for (let from = 0; from < numStates; from++) {
        for (let to = 0; to < numStates; to++) {
          if (from === to) continue; // Skip self-transitions

          const dayBuckets = new Array(BUCKETS_PER_DAY).fill(0);

          // For each time-of-day bucket, sum the 7 corresponding time-of-week buckets
          for (let dayBucket = 0; dayBucket < BUCKETS_PER_DAY; dayBucket++) {
            let sum = 0;
            // Sum across 7 days
            for (let day = 0; day < 7; day++) {
              const weekBucket = dayBucket + day * BUCKETS_PER_DAY;
              const index = transIndex(from, to, clockIndex, weekBucket, numStates);
              sum += data[index] || 0;
            }
            dayBuckets[dayBucket] = sum;
          }
          transCounts.push(dayBuckets);
        }
      }
      clocks[clockId].transCounts = transCounts;
    }

    return {
      numStates,
      clocks,
      // Metadata for array access
      metadata: {
        bucketsPerDay: BUCKETS_PER_DAY,
        numClocks: 5,
        clockOrder: ['utc', 'local', 'meanSolar', 'apparentSolar', 'unequalHours'],
      },
    };
  },
});

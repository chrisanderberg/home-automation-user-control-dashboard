/**
 * Convex queries for home automation user control dashboard.
 * 
 * This module implements Milestone 9: Queries for Raw Aggregates (All Clocks) +
 * Derived Time-of-Day Views.
 * 
 * All queries return data for all 5 clocks in a single response.
 * Queries do NOT accept clockId as input - they always return all clocks.
 */

import { query } from './_generated/server.js';
import { v } from 'convex/values';
import type { GenericQueryCtx } from 'convex/server';
import type { DataModel } from './_generated/dataModel.js';
import { aggregateTimeOfDay } from '@home-automation/core';
import type { ClockId } from '@home-automation/core';

type QueryCtx = GenericQueryCtx<DataModel>;

/**
 * All five clock identifiers that must be included in responses.
 */
const ALL_CLOCKS: ClockId[] = [
  'local',
  'utc',
  'meanSolar',
  'apparentSolar',
  'unequalHours',
];

/**
 * Helper function to aggregate raw stats from database rows.
 * Used by both getRawStats and getRawTimeOfDayProfile.
 */
async function aggregateRawStats(
  ctx: QueryCtx,
  controlId: string,
  modelId?: string,
): Promise<{
  holdMsByClock: Record<ClockId, Record<number, Record<number, number>>>;
  transCountsByClock: Record<ClockId, Record<number, Record<string, number>>>;
}> {
  // Query holdMs
  const holdMsRows = await ctx.db
    .query('holdMs')
    .withIndex('by_controlId', (q: any) => q.eq('controlId', controlId))
    .collect();

  // Filter by modelId if provided
  const filteredHoldMs = modelId
    ? holdMsRows.filter((row) => row.modelId === modelId)
    : holdMsRows;

  // Query transCounts
  const transCountsRows = await ctx.db
    .query('transCounts')
    .withIndex('by_controlId', (q: any) => q.eq('controlId', controlId))
    .collect();

  // Filter by modelId if provided
  const filteredTransCounts = modelId
    ? transCountsRows.filter((row) => row.modelId === modelId)
    : transCountsRows;

  // Aggregate holdMs by (clockId, bucketId, state)
  const holdMsByClock: Record<
    ClockId,
    Record<number, Record<number, number>>
  > = {
    local: {},
    utc: {},
    meanSolar: {},
    apparentSolar: {},
    unequalHours: {},
  };

  for (const row of filteredHoldMs) {
    if (!holdMsByClock[row.clockId][row.bucketId]) {
      holdMsByClock[row.clockId][row.bucketId] = {};
    }
    const bucket = holdMsByClock[row.clockId][row.bucketId];
    bucket[row.state] = (bucket[row.state] || 0) + row.ms;
  }

  // Aggregate transCounts by (clockId, bucketId, fromState, toState)
  const transCountsByClock: Record<
    ClockId,
    Record<number, Record<string, number>>
  > = {
    local: {},
    utc: {},
    meanSolar: {},
    apparentSolar: {},
    unequalHours: {},
  };

  for (const row of filteredTransCounts) {
    if (!transCountsByClock[row.clockId][row.bucketId]) {
      transCountsByClock[row.clockId][row.bucketId] = {};
    }
    const bucket = transCountsByClock[row.clockId][row.bucketId];
    const transitionKey = `${row.fromState}-${row.toState}`;
    bucket[transitionKey] = (bucket[transitionKey] || 0) + row.count;
  }

  return { holdMsByClock, transCountsByClock };
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
 * Returns data for all 5 clocks, with optional model filtering.
 * 
 * @param controlId - The control identifier
 * @param modelId - Optional model identifier. If provided, returns only that model's data.
 *                  If omitted, aggregates across all models.
 * @returns Raw statistics grouped by clock, with holdMs and transCounts per bucket
 */
export const getRawStats = query({
  // @ts-ignore - QueryBuilder type doesn't properly support args/handler syntax in this TypeScript version
  args: v.object({
    controlId: v.string(),
    modelId: v.optional(v.string()),
  }),
  handler: async (ctx: QueryCtx, args: any) => {
    // Aggregate raw stats using helper function
    const { holdMsByClock, transCountsByClock } = await aggregateRawStats(
      ctx,
      args.controlId,
      args.modelId,
    );

    // Build response with all clocks
    const clocks: Record<
      ClockId,
      {
        holdMs: Record<number, Record<number, number>>;
        transCounts: Record<number, Record<string, number>>;
      }
    > = {
      local: {
        holdMs: holdMsByClock.local,
        transCounts: transCountsByClock.local,
      },
      utc: {
        holdMs: holdMsByClock.utc,
        transCounts: transCountsByClock.utc,
      },
      meanSolar: {
        holdMs: holdMsByClock.meanSolar,
        transCounts: transCountsByClock.meanSolar,
      },
      apparentSolar: {
        holdMs: holdMsByClock.apparentSolar,
        transCounts: transCountsByClock.apparentSolar,
      },
      unequalHours: {
        holdMs: holdMsByClock.unequalHours,
        transCounts: transCountsByClock.unequalHours,
      },
    };

    return { clocks };
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
 * @returns Time-of-day profile grouped by clock, with holdMs and transCounts per dayBucket
 */
export const getRawTimeOfDayProfile = query({
  // @ts-ignore - QueryBuilder type doesn't properly support args/handler syntax in this TypeScript version
  args: v.object({
    controlId: v.string(),
    modelId: v.optional(v.string()),
  }),
  handler: async (ctx: QueryCtx, args: any) => {
    // Aggregate raw stats using helper function
    const { holdMsByClock, transCountsByClock } = await aggregateRawStats(
      ctx,
      args.controlId,
      args.modelId,
    );

    // Build time-of-day profiles for each clock
    const clocks: Record<
      ClockId,
      {
        holdMs: Record<number, Record<number, number>>;
        transCounts: Record<number, Record<string, number>>;
      }
    > = {
      local: { holdMs: {}, transCounts: {} },
      utc: { holdMs: {}, transCounts: {} },
      meanSolar: { holdMs: {}, transCounts: {} },
      apparentSolar: { holdMs: {}, transCounts: {} },
      unequalHours: { holdMs: {}, transCounts: {} },
    };

    // Process each clock
    for (const clockId of ALL_CLOCKS) {
      const clockHoldMs = holdMsByClock[clockId];
      const clockTransCounts = transCountsByClock[clockId];

      // Aggregate holdMs by state first, then aggregate time-of-day
      // We need to aggregate each state separately
      const holdMsByState = new Map<number, Map<number, number>>();

      // Collect all states and their bucket data
      for (const [bucketIdStr, stateData] of Object.entries(clockHoldMs)) {
        const bucketId = Number(bucketIdStr);
        for (const [stateStr, ms] of Object.entries(stateData)) {
          const state = Number(stateStr);
          if (!holdMsByState.has(state)) {
            holdMsByState.set(state, new Map());
          }
          holdMsByState.get(state)!.set(bucketId, ms);
        }
      }

      // Aggregate each state's time-of-week buckets into time-of-day buckets
      const aggregatedHoldMs: Record<number, Record<number, number>> = {};
      for (const [state, weekBuckets] of holdMsByState.entries()) {
        const dayBuckets = aggregateTimeOfDay(
          weekBuckets,
          (a, b) => a + b,
          0,
        );

        for (const [dayBucket, ms] of dayBuckets.entries()) {
          if (!aggregatedHoldMs[dayBucket]) {
            aggregatedHoldMs[dayBucket] = {};
          }
          aggregatedHoldMs[dayBucket][state] = ms;
        }
      }

      // Aggregate transCounts by transition key first, then aggregate time-of-day
      const transCountsByTransition = new Map<string, Map<number, number>>();

      // Collect all transitions and their bucket data
      for (const [bucketIdStr, transitionData] of Object.entries(
        clockTransCounts,
      )) {
        const bucketId = Number(bucketIdStr);
        for (const [transitionKey, count] of Object.entries(transitionData)) {
          if (!transCountsByTransition.has(transitionKey)) {
            transCountsByTransition.set(transitionKey, new Map());
          }
          transCountsByTransition.get(transitionKey)!.set(bucketId, count);
        }
      }

      // Aggregate each transition's time-of-week buckets into time-of-day buckets
      const aggregatedTransCounts: Record<number, Record<string, number>> = {};
      for (const [transitionKey, weekBuckets] of transCountsByTransition.entries()) {
        const dayBuckets = aggregateTimeOfDay(
          weekBuckets,
          (a, b) => a + b,
          0,
        );

        for (const [dayBucket, count] of dayBuckets.entries()) {
          if (!aggregatedTransCounts[dayBucket]) {
            aggregatedTransCounts[dayBucket] = {};
          }
          aggregatedTransCounts[dayBucket][transitionKey] = count;
        }
      }

      clocks[clockId] = {
        holdMs: aggregatedHoldMs,
        transCounts: aggregatedTransCounts,
      };
    }

    return { clocks };
  },
});

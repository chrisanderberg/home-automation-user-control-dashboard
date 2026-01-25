/**
 * Test scenarios for Milestone 9: Query APIs for Raw Aggregates
 * 
 * This file documents test scenarios for the query functionality.
 * These tests verify that queries correctly return raw aggregates and time-of-day profiles
 * for all clocks, with proper model filtering.
 * 
 * Note: Convex testing is typically done through integration tests or manual verification.
 * These scenarios can be executed manually via the Convex dashboard or automated
 * using Convex's test framework when available.
 * 
 * Test Execution:
 * - Run these scenarios manually via Convex dashboard queries
 * - Or use Convex's test framework (when available) to automate
 */

/**
 * Test Scenario 1: Basic Queries (getControlDefinition, getControlRuntime)
 * 
 * Setup:
 * 1. Create config
 * 2. Create a control (radiobutton or slider)
 * 
 * Action:
 * 3. Query getControlDefinition(controlId)
 * 4. Query getControlRuntime(controlId)
 * 
 * Verify:
 * - getControlDefinition returns the control definition
 * - getControlRuntime returns the runtime state
 * - Querying non-existent control returns null
 */
export const testScenario1_BasicQueries = {
  description: 'Basic lookup queries return correct data',
  steps: [
    'Create config and control',
    'Query getControlDefinition',
    'Query getControlRuntime',
    'Verify correct data returned',
    'Query non-existent control',
    'Verify null returned',
  ],
};

/**
 * Test Scenario 2: getRawStats - All Clocks Response
 * 
 * Setup:
 * 1. Create config and control
 * 2. Set active model
 * 3. Create committed events that populate dense analytics arrays
 * 
 * Action:
 * 4. Query getRawStats({ controlId })
 * 
 * Verify:
 * - Response includes all 5 clocks as keys: utc, local, meanSolar, apparentSolar, unequalHours
 * - Each clock has holdMs and transCounts as dense arrays
 * - holdMs: number[][] where [state][bucket] = milliseconds
 * - transCounts: number[][] where [transitionGroup][bucket] = count
 * - Arrays are dense (all values present, zeros for missing data)
 * - Response includes metadata (numStates, clockOrder, bucketsPerWeek)
 */
export const testScenario2_AllClocksResponse = {
  description: 'getRawStats returns all 5 clocks in response',
  steps: [
    'Create config and control',
    'Create committed events',
    'Query getRawStats',
    'Verify all 5 clocks present',
    'Verify empty clocks return zero-filled arrays',
  ],
};

/**
 * Test Scenario 3: getRawStats - Model Filtering
 * 
 * Setup:
 * 1. Create config and control
 * 2. Set model A, create committed events
 * 3. Set model B, create committed events
 * 
 * Action:
 * 4. Query getRawStats({ controlId, modelId: "modelA" })
 * 5. Query getRawStats({ controlId, modelId: "modelB" })
 * 6. Query getRawStats({ controlId }) // no modelId
 * 
 * Verify:
 * - Query with modelId returns only that model's dense array data
 * - Query without modelId returns aggregated data (element-wise sum of arrays)
 * - Aggregated array = sum of per-model arrays (element by element)
 * - All clocks included in each response
 */
export const testScenario3_ModelFiltering = {
  description: 'Model filtering works correctly (single model vs aggregated)',
  steps: [
    'Create control with multiple models',
    'Query with modelId (modelA)',
    'Query with modelId (modelB)',
    'Query without modelId (aggregated)',
    'Verify aggregated = sum of per-model queries',
  ],
};

/**
 * Test Scenario 4: getRawTimeOfDayProfile - Time-of-Day Aggregation
 * 
 * Setup:
 * 1. Create config and control
 * 2. Create committed events across multiple days of the week
 * 3. Ensure data exists in different time-of-week buckets that map to same time-of-day
 * 
 * Action:
 * 4. Query getRawTimeOfDayProfile({ controlId })
 * 
 * Verify:
 * - Response includes all 5 clocks
 * - Time-of-day buckets are 0-287 (not 0-2015)
 * - holdMs: number[][] where [state][dayBucket] = milliseconds
 * - transCounts: number[][] where [transitionGroup][dayBucket] = count
 * - For each time-of-day bucket, value = sum of 7 corresponding time-of-week buckets
 * - Example: dayBucket 0 (00:00) = sum of buckets 0, 288, 576, 864, 1152, 1440, 1728
 * - Both holdMs and transCounts are aggregated correctly
 */
export const testScenario4_TimeOfDayAggregation = {
  description: 'Time-of-day profile correctly aggregates across 7 days',
  steps: [
    'Create control with data across multiple days',
    'Query getRawTimeOfDayProfile',
    'Verify time-of-day buckets (0-287)',
    'Verify aggregation = sum of 7 corresponding time-of-week buckets',
  ],
};

/**
 * Test Scenario 5: getRawTimeOfDayProfile - Model Filtering
 * 
 * Setup:
 * 1. Create config and control
 * 2. Create data for multiple models across multiple days
 * 
 * Action:
 * 3. Query getRawTimeOfDayProfile({ controlId, modelId: "modelA" })
 * 4. Query getRawTimeOfDayProfile({ controlId }) // aggregated
 * 
 * Verify:
 * - Model filtering works same as getRawStats
 * - Aggregated = sum of per-model queries
 * - Time-of-day aggregation applied correctly for each model
 */
export const testScenario5_TimeOfDayModelFiltering = {
  description: 'Time-of-day profile respects model filtering',
  steps: [
    'Create control with multiple models',
    'Query time-of-day profile with modelId',
    'Query time-of-day profile without modelId',
    'Verify aggregation works correctly',
  ],
};

/**
 * Test Scenario 6: Missing Data Handling
 * 
 * Setup:
 * 1. Create config and control
 * 2. Do NOT create any committed events (no data in analytics arrays)
 * 
 * Action:
 * 3. Query getRawStats({ controlId })
 * 4. Query getRawTimeOfDayProfile({ controlId })
 * 
 * Verify:
 * - Queries return successfully (no errors)
 * - All 5 clocks present in response
 * - Each clock has zero-filled holdMs and transCounts arrays
 * - Arrays have correct dimensions (not empty, but all zeros)
 */
export const testScenario6_MissingDataHandling = {
  description: 'Missing data returns empty structures, not errors',
  steps: [
    'Create control with no committed events',
    'Query getRawStats',
    'Query getRawTimeOfDayProfile',
    'Verify empty structures returned',
    'Verify no errors thrown',
  ],
};

/**
 * Test Scenario 7: Partial Clock Data
 * 
 * Setup:
 * 1. Create config with extreme latitude (polar region)
 * 2. Create control and committed events
 * 
 * Action:
 * 3. Query getRawStats({ controlId })
 * 
 * Verify:
 * - All 5 clocks present in response
 * - Clocks with undefined mappings (e.g., unequalHours during polar day/night) return empty structures
 * - Clocks with defined mappings return data
 * - No errors thrown for undefined clocks
 */
export const testScenario7_PartialClockData = {
  description: 'Clocks with undefined mappings return empty structures',
  steps: [
    'Create config with extreme latitude',
    'Create committed events',
    'Query getRawStats',
    'Verify undefined clocks return empty structures',
    'Verify defined clocks return data',
  ],
};

/**
 * Test Scenario 8: Data Structure Correctness
 * 
 * Setup:
 * 1. Create config and control
 * 2. Create committed events with known states and transitions
 * 
 * Action:
 * 3. Query getRawStats({ controlId })
 * 
 * Verify:
 * - holdMs structure: number[][] where [state][bucket] = milliseconds
 *   - Example: holdMs[0][0] = 5000 means state 0, bucket 0 = 5000ms
 *   - Example: holdMs[1][0] = 3000 means state 1, bucket 0 = 3000ms
 * - transCounts structure: number[][] where [transitionGroup][bucket] = count
 *   - Transition groups are ordered: (0→1), (0→2), ..., (1→0), (1→2), ..., (N-1→N-2)
 *   - Example: transCounts[0][0] = 2 means first transition (0→1), bucket 0 = 2 counts
 * - Arrays are dense (all indices present, zeros for missing data)
 * - Array dimensions match: holdMs.length = numStates, holdMs[state].length = 2016
 */
export const testScenario8_DataStructureCorrectness = {
  description: 'Data structures match specification',
  steps: [
    'Create control with known data',
    'Query getRawStats',
    'Verify holdMs structure',
    'Verify transCounts structure',
    'Verify transition key format',
  ],
};

/**
 * Test Scenario 9: Time-of-Day Structure Correctness
 * 
 * Setup:
 * 1. Create config and control
 * 2. Create committed events across multiple days
 * 
 * Action:
 * 3. Query getRawTimeOfDayProfile({ controlId })
 * 
 * Verify:
 * - dayBucket range is 0-287 (not 0-2015)
 * - holdMs structure: number[][] where [state][dayBucket] = milliseconds
 * - transCounts structure: number[][] where [transitionGroup][dayBucket] = count
 * - Values correctly aggregated from 7 time-of-week buckets
 * - Arrays are dense (all indices present)
 */
export const testScenario9_TimeOfDayStructure = {
  description: 'Time-of-day profile structure matches specification',
  steps: [
    'Create control with multi-day data',
    'Query getRawTimeOfDayProfile',
    'Verify dayBucket range (0-287)',
    'Verify structure matches specification',
  ],
};

/**
 * Helper function to verify query response structure for dense arrays
 * 
 * @param response - Query response to verify
 * @param expectedClocks - Array of expected clock IDs
 * @param expectedNumStates - Expected number of states
 * @param expectedBucketsPerWeek - Expected buckets per week (2016 for time-of-week, 288 for time-of-day)
 * @returns true if structure is correct
 */
export function verifyResponseStructure(
  response: any,
  expectedClocks: string[] = ['utc', 'local', 'meanSolar', 'apparentSolar', 'unequalHours'],
  expectedNumStates?: number,
  expectedBucketsPerWeek: number = 2016,
): boolean {
  if (!response || !response.clocks) {
    return false;
  }

  // Check numStates if provided
  if (expectedNumStates !== undefined) {
    if (response.numStates !== expectedNumStates) {
      return false;
    }
  }

  // Check all expected clocks are present
  for (const clockId of expectedClocks) {
    if (!(clockId in response.clocks)) {
      return false;
    }

    const clockData = response.clocks[clockId];
    if (!clockData || typeof clockData !== 'object') {
      return false;
    }

    // Check holdMs and transCounts are present and are arrays
    if (!('holdMs' in clockData) || !('transCounts' in clockData)) {
      return false;
    }

    // Check they are arrays
    if (!Array.isArray(clockData.holdMs) || !Array.isArray(clockData.transCounts)) {
      return false;
    }

    // Verify dimensions if numStates provided
    if (expectedNumStates !== undefined) {
      // holdMs should be [numStates][bucketsPerWeek]
      if (clockData.holdMs.length !== expectedNumStates) {
        return false;
      }
      for (const stateArray of clockData.holdMs) {
        if (!Array.isArray(stateArray) || stateArray.length !== expectedBucketsPerWeek) {
          return false;
        }
      }

      // transCounts should be [numStates * (numStates - 1)][bucketsPerWeek]
      const expectedTransGroups = expectedNumStates * (expectedNumStates - 1);
      if (clockData.transCounts.length !== expectedTransGroups) {
        return false;
      }
      for (const transArray of clockData.transCounts) {
        if (!Array.isArray(transArray) || transArray.length !== expectedBucketsPerWeek) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Helper function to sum two dense arrays element-wise.
 * Used to combine per-model responses into an expected aggregate.
 * 
 * @param target - Target array (will be modified)
 * @param source - Source array to add
 */
function sumArrays(target: number[], source: number[]): void {
  if (target.length !== source.length) {
    throw new Error(
      `Array length mismatch: target=${target.length}, source=${source.length}`,
    );
  }
  for (let i = 0; i < target.length; i++) {
    target[i] = (target[i] || 0) + (source[i] || 0);
  }
}

/**
 * Helper function to recursively merge numeric values by summing them.
 * Used to combine per-model responses into an expected aggregate.
 * 
 * @deprecated Use sumArrays for dense array aggregation
 * @param target - Target object to merge into (will be modified)
 * @param source - Source object to merge from
 */
function mergeNumericValues(target: any, source: any): void {
  if (source === null || source === undefined) {
    return;
  }

  // Assume source is an object
  if (typeof source === 'object' && !Array.isArray(source)) {
    // Ensure target is an object
    if (target === null || target === undefined || typeof target !== 'object' || Array.isArray(target)) {
      return; // Type mismatch, will be handled by deep equality check
    }

    // Recursively merge objects
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (typeof sourceValue === 'number') {
          // Sum numeric values (treat missing as 0)
          target[key] = (targetValue ?? 0) + sourceValue;
        } else if (Array.isArray(sourceValue)) {
          // Always assign a new array, never mutate in-place
          if (!Array.isArray(targetValue)) {
            target[key] = [...sourceValue];
          } else {
            target[key] = [...sourceValue];
          }
        } else if (
          typeof sourceValue === 'object' &&
          sourceValue !== null &&
          !Array.isArray(sourceValue)
        ) {
          // Recursively merge nested objects
          if (
            typeof targetValue === 'object' &&
            targetValue !== null &&
            !Array.isArray(targetValue)
          ) {
            mergeNumericValues(targetValue, sourceValue);
          } else {
            // Target doesn't have this key or has wrong type, deep clone and set
            target[key] = deepClone(sourceValue);
          }
        } else {
          // For other types, just set (though we expect mostly numbers)
          target[key] = sourceValue;
        }
      }
    }
  }
}

/**
 * Helper function to deep clone an object.
 * 
 * @param obj - Object to clone
 * @returns Deep clone of the object
 */
function deepClone(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item));
  }

  const cloned: any = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

/**
 * Helper function to normalize numeric values (treat missing as 0).
 * Ensures consistent structure and converts null/undefined numeric fields to 0.
 * 
 * @param obj - Object to normalize
 * @returns Normalized object
 */
function normalizeNumericFields(obj: any): any {
  if (obj === null || obj === undefined) {
    return {};
  }

  if (typeof obj === 'number') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => normalizeNumericFields(item));
  }

  if (typeof obj === 'object' && !Array.isArray(obj)) {
    const normalized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        if (typeof value === 'number') {
          normalized[key] = value;
        } else if (value === null || value === undefined) {
          // Treat missing numeric fields as 0
          normalized[key] = 0;
        } else {
          normalized[key] = normalizeNumericFields(value);
        }
      }
    }
    return normalized;
  }

  return obj;
}

/**
 * Helper function to perform deep equality check between two objects.
 * Treats missing numeric fields as 0.
 * 
 * @param a - First object
 * @param b - Second object
 * @returns true if objects are deeply equal
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (a === null || b === null || a === undefined || b === undefined) {
    // Treat null/undefined as equivalent to 0 for numeric contexts
    // But only if the other value is a number
    if (a === null || a === undefined) {
      if (typeof b === 'number') {
        return b === 0;
      }
      return a === b;
    }
    if (b === null || b === undefined) {
      if (typeof a === 'number') {
        return a === 0;
      }
      return a === b;
    }
    return a === b;
  }

  if (typeof a === 'number' && typeof b === 'number') {
    // Handle NaN and floating point precision
    if (isNaN(a) && isNaN(b)) {
      return true;
    }
    return a === b;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  if (typeof a === 'object' && !Array.isArray(a)) {
    if (typeof b !== 'object' || Array.isArray(b)) {
      return false;
    }

    // Collect all unique keys from both objects
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    const keysA = new Set(Object.keys(a));
    const keysB = new Set(Object.keys(b));

    // Check each key
    for (const key of allKeys) {
      const valueA = a[key];
      const valueB = b[key];
      const hasA = keysA.has(key);
      const hasB = keysB.has(key);

      if (!hasA && hasB) {
        // Key exists in b but not in a
        // If it's a number, treat missing as 0
        if (typeof valueB === 'number') {
          if (valueB !== 0) {
            return false;
          }
        } else {
          return false;
        }
      } else if (hasA && !hasB) {
        // Key exists in a but not in b
        // If it's a number, treat missing as 0
        if (typeof valueA === 'number') {
          if (valueA !== 0) {
            return false;
          }
        } else {
          return false;
        }
      } else {
        // Key exists in both, compare recursively
        if (!deepEqual(valueA, valueB)) {
          return false;
        }
      }
    }

    return true;
  }

  return a === b;
}

/**
 * Helper function to verify aggregated data equals sum of per-model data (dense arrays)
 * 
 * @param aggregatedResponse - Response from query without modelId
 * @param perModelResponses - Array of responses from queries with modelId
 * @returns true if aggregated equals element-wise sum
 */
export function verifyAggregation(
  aggregatedResponse: any,
  perModelResponses: any[],
): boolean {
  if (!aggregatedResponse || !perModelResponses || perModelResponses.length === 0) {
    return false;
  }

  const numStates = aggregatedResponse.numStates;
  if (!numStates) {
    return false;
  }

  // For each clock, sum the per-model arrays element-wise
  for (const clockId of ['utc', 'local', 'meanSolar', 'apparentSolar', 'unequalHours']) {
    // Sum holdMs arrays
    const expectedHoldMs: number[][] = [];
    for (let state = 0; state < numStates; state++) {
      const stateBuckets = new Array(2016).fill(0);
      for (const perModelResponse of perModelResponses) {
        if (
          perModelResponse?.clocks?.[clockId]?.holdMs?.[state]
        ) {
          const modelStateBuckets = perModelResponse.clocks[clockId].holdMs[state];
          for (let bucket = 0; bucket < 2016; bucket++) {
            stateBuckets[bucket] += modelStateBuckets[bucket] || 0;
          }
        }
      }
      expectedHoldMs.push(stateBuckets);
    }

    // Sum transCounts arrays
    const numTransGroups = numStates * (numStates - 1);
    const expectedTransCounts: number[][] = [];
    for (let group = 0; group < numTransGroups; group++) {
      const groupBuckets = new Array(2016).fill(0);
      for (const perModelResponse of perModelResponses) {
        if (
          perModelResponse?.clocks?.[clockId]?.transCounts?.[group]
        ) {
          const modelGroupBuckets = perModelResponse.clocks[clockId].transCounts[group];
          for (let bucket = 0; bucket < 2016; bucket++) {
            groupBuckets[bucket] += modelGroupBuckets[bucket] || 0;
          }
        }
      }
      expectedTransCounts.push(groupBuckets);
    }

    // Compare with aggregated response
    const actualHoldMs = aggregatedResponse.clocks[clockId]?.holdMs;
    const actualTransCounts = aggregatedResponse.clocks[clockId]?.transCounts;

    if (!actualHoldMs || !actualTransCounts) {
      return false;
    }

    // Compare holdMs
    for (let state = 0; state < numStates; state++) {
      for (let bucket = 0; bucket < 2016; bucket++) {
        if (Math.abs((actualHoldMs[state]?.[bucket] || 0) - (expectedHoldMs[state]?.[bucket] || 0)) > 0.001) {
          return false;
        }
      }
    }

    // Compare transCounts
    for (let group = 0; group < numTransGroups; group++) {
      for (let bucket = 0; bucket < 2016; bucket++) {
        if (Math.abs((actualTransCounts[group]?.[bucket] || 0) - (expectedTransCounts[group]?.[bucket] || 0)) > 0.001) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Expected test results summary
 */
export const expectedResults = {
  scenario1: {
    getControlDefinitionReturnsData: true,
    getControlRuntimeReturnsData: true,
    nonExistentControlReturnsNull: true,
  },
  scenario2: {
    allFiveClocksPresent: true,
    emptyClocksReturnEmptyObjects: true,
    structureMatchesSpec: true,
  },
  scenario3: {
    modelFilteringWorks: true,
    aggregatedEqualsSum: true,
    allClocksInEachResponse: true,
  },
  scenario4: {
    timeOfDayBucketsCorrect: true,
    aggregationCorrect: true,
    allClocksPresent: true,
  },
  scenario5: {
    modelFilteringWorks: true,
    timeOfDayAggregationCorrect: true,
  },
  scenario6: {
    noErrorsThrown: true,
    emptyStructuresReturned: true,
    allClocksPresent: true,
  },
  scenario7: {
    undefinedClocksEmpty: true,
    definedClocksHaveData: true,
    noErrorsThrown: true,
  },
  scenario8: {
    holdMsStructureCorrect: true,
    transCountsStructureCorrect: true,
    transitionKeyFormatCorrect: true,
  },
  scenario9: {
    dayBucketRangeCorrect: true,
    structureMatchesSpec: true,
    aggregationCorrect: true,
  },
};

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
 * 3. Create committed events that populate holdMs and transCounts
 * 
 * Action:
 * 4. Query getRawStats({ controlId })
 * 
 * Verify:
 * - Response includes all 5 clocks as keys: local, utc, meanSolar, apparentSolar, unequalHours
 * - Each clock has holdMs and transCounts structures
 * - Clocks with no data return empty objects (not null/undefined)
 * - Data structure matches specification: Record<bucketId, Record<state, ms>> for holdMs
 * - Data structure matches specification: Record<bucketId, Record<transitionKey, count>> for transCounts
 */
export const testScenario2_AllClocksResponse = {
  description: 'getRawStats returns all 5 clocks in response',
  steps: [
    'Create config and control',
    'Create committed events',
    'Query getRawStats',
    'Verify all 5 clocks present',
    'Verify empty clocks return empty objects',
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
 * - Query with modelId returns only that model's data
 * - Query without modelId returns aggregated data (sum across models)
 * - Aggregated data = sum of per-model queries
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
 * 2. Do NOT create any committed events (no data in holdMs/transCounts)
 * 
 * Action:
 * 3. Query getRawStats({ controlId })
 * 4. Query getRawTimeOfDayProfile({ controlId })
 * 
 * Verify:
 * - Queries return successfully (no errors)
 * - All 5 clocks present in response
 * - Each clock has empty holdMs and transCounts objects
 * - Not null/undefined, but empty structures
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
 * - holdMs structure: Record<bucketId, Record<state, ms>>
 *   - Example: { 0: { 0: 5000, 1: 3000 } } means bucket 0: state 0 = 5000ms, state 1 = 3000ms
 * - transCounts structure: Record<bucketId, Record<transitionKey, count>>
 *   - transitionKey format: "${fromState}-${toState}"
 *   - Example: { 0: { "0-1": 2, "1-0": 1 } } means bucket 0: 0→1 = 2 transitions, 1→0 = 1 transition
 * - All numeric keys are numbers (not strings)
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
 * - holdMs structure: Record<dayBucket, Record<state, ms>>
 * - transCounts structure: Record<dayBucket, Record<transitionKey, count>>
 * - Values correctly aggregated from 7 time-of-week buckets
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
 * Helper function to verify query response structure
 * 
 * @param response - Query response to verify
 * @param expectedClocks - Array of expected clock IDs
 * @returns true if structure is correct
 */
export function verifyResponseStructure(
  response: any,
  expectedClocks: string[] = ['local', 'utc', 'meanSolar', 'apparentSolar', 'unequalHours'],
): boolean {
  if (!response || !response.clocks) {
    return false;
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

    // Check holdMs and transCounts are present (even if empty)
    if (!('holdMs' in clockData) || !('transCounts' in clockData)) {
      return false;
    }

    // Check they are objects (not null/undefined)
    if (!clockData.holdMs || typeof clockData.holdMs !== 'object' || !clockData.transCounts || typeof clockData.transCounts !== 'object') {
      return false;
    }
  }

  return true;
}

/**
 * Helper function to recursively merge numeric values by summing them.
 * Used to combine per-model responses into an expected aggregate.
 * 
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
 * Helper function to verify aggregated data equals sum of per-model data
 * 
 * @param aggregatedResponse - Response from query without modelId
 * @param perModelResponses - Array of responses from queries with modelId
 * @returns true if aggregated equals sum
 */
export function verifyAggregation(
  aggregatedResponse: any,
  perModelResponses: any[],
): boolean {
  if (!aggregatedResponse || !perModelResponses || perModelResponses.length === 0) {
    return false;
  }

  // Start with a deep clone of the first per-model response
  let expectedAggregate = deepClone(perModelResponses[0]);

  // Merge remaining per-model responses
  for (let i = 1; i < perModelResponses.length; i++) {
    const perModelResponse = perModelResponses[i];
    if (!perModelResponse) {
      continue;
    }

    // Merge clocks from this per-model response into expected aggregate
    if (perModelResponse.clocks && expectedAggregate.clocks) {
      for (const clockId in perModelResponse.clocks) {
        if (perModelResponse.clocks.hasOwnProperty(clockId)) {
          const clockData = perModelResponse.clocks[clockId];
          if (!expectedAggregate.clocks[clockId]) {
            expectedAggregate.clocks[clockId] = deepClone(clockData);
          } else {
            // Merge holdMs
            if (clockData.holdMs) {
              if (!expectedAggregate.clocks[clockId].holdMs) {
                expectedAggregate.clocks[clockId].holdMs = deepClone(clockData.holdMs);
              } else {
                mergeNumericValues(
                  expectedAggregate.clocks[clockId].holdMs,
                  clockData.holdMs,
                );
              }
            }

            // Merge transCounts
            if (clockData.transCounts) {
              if (!expectedAggregate.clocks[clockId].transCounts) {
                expectedAggregate.clocks[clockId].transCounts = deepClone(
                  clockData.transCounts,
                );
              } else {
                mergeNumericValues(
                  expectedAggregate.clocks[clockId].transCounts,
                  clockData.transCounts,
                );
              }
            }
          }
        }
      }
    }
  }

  // Normalize types (treat missing numeric fields as 0)
  const normalizedExpected = normalizeNumericFields(expectedAggregate);
  const normalizedActual = normalizeNumericFields(aggregatedResponse);

  // Perform deep equality check
  return deepEqual(normalizedExpected, normalizedActual);
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

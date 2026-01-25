/**
 * Tests for dense array index math utilities.
 * 
 * Verifies correctness of index calculations according to MANUAL.md specification.
 */

import { describe, it, expect } from 'vitest';
import {
  BUCKETS_PER_WEEK,
  NUM_CLOCKS,
  VALUES_PER_BUCKET_GROUP,
  CLOCK_INDICES,
  getArraySize,
  holdIndex,
  transGroupIndex,
  transIndex,
  createDenseArray,
  validateArraySize,
} from './index.js';

describe('denseArray index math', () => {
  describe('constants', () => {
    it('should have correct bucket and clock constants', () => {
      expect(BUCKETS_PER_WEEK).toBe(2016);
      expect(NUM_CLOCKS).toBe(5);
      expect(VALUES_PER_BUCKET_GROUP).toBe(10080); // 2016 × 5
    });

    it('should have correct clock index mapping', () => {
      expect(CLOCK_INDICES.utc).toBe(0);
      expect(CLOCK_INDICES.local).toBe(1);
      expect(CLOCK_INDICES.meanSolar).toBe(2);
      expect(CLOCK_INDICES.apparentSolar).toBe(3);
      expect(CLOCK_INDICES.unequalHours).toBe(4);
    });
  });

  describe('getArraySize', () => {
    it('should calculate size for 2-state control', () => {
      // N=2: 2² × 10080 = 40320
      expect(getArraySize(2)).toBe(40320);
    });

    it('should calculate size for 6-state control (slider)', () => {
      // N=6: 6² × 10080 = 362880
      expect(getArraySize(6)).toBe(362880);
    });

    it('should calculate size for 10-state control (max radiobutton)', () => {
      // N=10: 10² × 10080 = 1008000
      expect(getArraySize(10)).toBe(1008000);
    });
  });

  describe('holdIndex', () => {
    it('should calculate index for state 0, UTC, bucket 0', () => {
      // holdIndex(0, 0, 0) = (0 × 10080) + (0 × 2016) + 0 = 0
      expect(holdIndex(0, 0, 0)).toBe(0);
    });

    it('should calculate index for state 0, UTC, bucket 1', () => {
      // holdIndex(0, 0, 1) = (0 × 10080) + (0 × 2016) + 1 = 1
      expect(holdIndex(0, 0, 1)).toBe(1);
    });

    it('should calculate index for state 0, Local, bucket 0', () => {
      // holdIndex(0, 1, 0) = (0 × 10080) + (1 × 2016) + 0 = 2016
      expect(holdIndex(0, 1, 0)).toBe(2016);
    });

    it('should calculate index for state 1, UTC, bucket 0', () => {
      // holdIndex(1, 0, 0) = (1 × 10080) + (0 × 2016) + 0 = 10080
      expect(holdIndex(1, 0, 0)).toBe(10080);
    });

    it('should calculate index for state 5, Unequal hours, bucket 2015', () => {
      // holdIndex(5, 4, 2015) = (5 × 10080) + (4 × 2016) + 2015 = 50400 + 8064 + 2015 = 60479
      expect(holdIndex(5, 4, 2015)).toBe(60479);
    });
  });

  describe('transGroupIndex', () => {
    describe('2-state control (N=2)', () => {
      const numStates = 2;

      it('should calculate group index for 0 → 1', () => {
        // offsetWithinFromBlock(0, 1) = 1 - 1 = 0
        // transGroupIndex(0, 1) = (0 × 1) + 0 = 0
        expect(transGroupIndex(0, 1, numStates)).toBe(0);
      });

      it('should calculate group index for 1 → 0', () => {
        // offsetWithinFromBlock(1, 0) = 0 (since 0 < 1)
        // transGroupIndex(1, 0) = (1 × 1) + 0 = 1
        expect(transGroupIndex(1, 0, numStates)).toBe(1);
      });
    });

    describe('6-state control (N=6, slider)', () => {
      const numStates = 6;

      it('should calculate group index for 0 → 1', () => {
        // offsetWithinFromBlock(0, 1) = 1 - 1 = 0
        // transGroupIndex(0, 1) = (0 × 5) + 0 = 0
        expect(transGroupIndex(0, 1, numStates)).toBe(0);
      });

      it('should calculate group index for 0 → 5', () => {
        // offsetWithinFromBlock(0, 5) = 5 - 1 = 4
        // transGroupIndex(0, 5) = (0 × 5) + 4 = 4
        expect(transGroupIndex(0, 5, numStates)).toBe(4);
      });

      it('should calculate group index for 3 → 0', () => {
        // offsetWithinFromBlock(3, 0) = 0 (since 0 < 3)
        // transGroupIndex(3, 0) = (3 × 5) + 0 = 15
        expect(transGroupIndex(3, 0, numStates)).toBe(15);
      });

      it('should calculate group index for 3 → 2', () => {
        // offsetWithinFromBlock(3, 2) = 2 (since 2 < 3)
        // transGroupIndex(3, 2) = (3 × 5) + 2 = 17
        expect(transGroupIndex(3, 2, numStates)).toBe(17);
      });

      it('should calculate group index for 3 → 5', () => {
        // offsetWithinFromBlock(3, 5) = 5 - 1 = 4
        // transGroupIndex(3, 5) = (3 × 5) + 4 = 19
        expect(transGroupIndex(3, 5, numStates)).toBe(19);
      });

      it('should calculate group index for 5 → 0', () => {
        // offsetWithinFromBlock(5, 0) = 0 (since 0 < 5)
        // transGroupIndex(5, 0) = (5 × 5) + 0 = 25
        expect(transGroupIndex(5, 0, numStates)).toBe(25);
      });

      it('should calculate group index for 5 → 4', () => {
        // offsetWithinFromBlock(5, 4) = 4 (since 4 < 5)
        // transGroupIndex(5, 4) = (5 × 5) + 4 = 29
        expect(transGroupIndex(5, 4, numStates)).toBe(29);
      });
    });

    it('should reject self-transitions', () => {
      expect(() => transGroupIndex(0, 0, 6)).toThrow('Self-transitions');
      expect(() => transGroupIndex(3, 3, 6)).toThrow('Self-transitions');
    });

    it('should reject invalid state indices', () => {
      expect(() => transGroupIndex(-1, 1, 6)).toThrow('Invalid state indices');
      expect(() => transGroupIndex(0, 6, 6)).toThrow('Invalid state indices');
      expect(() => transGroupIndex(0, 1, 0)).toThrow('Invalid state indices');
    });
  });

  describe('transIndex', () => {
    const numStates = 6; // Slider with 6 states

    it('should calculate index for first transition (0 → 1, UTC, bucket 0)', () => {
      // transGroupIndex(0, 1) = 0
      // transIndex = (6 × 10080) + (0 × 10080) + (0 × 2016) + 0 = 60480
      expect(transIndex(0, 1, 0, 0, numStates)).toBe(60480);
    });

    it('should calculate index for 0 → 1, UTC, bucket 1', () => {
      // transGroupIndex(0, 1) = 0
      // transIndex = (6 × 10080) + (0 × 10080) + (0 × 2016) + 1 = 60481
      expect(transIndex(0, 1, 0, 1, numStates)).toBe(60481);
    });

    it('should calculate index for 0 → 1, Local, bucket 0', () => {
      // transGroupIndex(0, 1) = 0
      // transIndex = (6 × 10080) + (0 × 10080) + (1 × 2016) + 0 = 62496
      expect(transIndex(0, 1, 1, 0, numStates)).toBe(62496);
    });

    it('should calculate index for 3 → 0, UTC, bucket 0', () => {
      // transGroupIndex(3, 0) = 15
      // transIndex = (6 × 10080) + (15 × 10080) + (0 × 2016) + 0 = 211680
      expect(transIndex(3, 0, 0, 0, numStates)).toBe(211680);
    });

    it('should calculate index for 5 → 4, Unequal hours, bucket 2015', () => {
      // transGroupIndex(5, 4) = 29
      // transIndex = (6 × 10080) + (29 × 10080) + (4 × 2016) + 2015 = 352800 + 8064 + 2015 = 362879
      expect(transIndex(5, 4, 4, 2015, numStates)).toBe(362879);
    });
  });

  describe('createDenseArray', () => {
    it('should create array of correct size for 2 states', () => {
      const array = createDenseArray(2);
      expect(array.length).toBe(40320);
      expect(array.every((v) => v === 0)).toBe(true);
    });

    it('should create array of correct size for 6 states', () => {
      const array = createDenseArray(6);
      expect(array.length).toBe(362880);
      expect(array.every((v) => v === 0)).toBe(true);
    });
  });

  describe('validateArraySize', () => {
    it('should validate correct array size', () => {
      const array = createDenseArray(6);
      expect(validateArraySize(array, 6)).toBe(true);
    });

    it('should reject incorrect array size', () => {
      const array = new Array(1000).fill(0);
      expect(validateArraySize(array, 6)).toBe(false);
    });
  });

  describe('integration: verify array layout', () => {
    it('should have correct layout for 6-state control', () => {
      const numStates = 6;
      const array = createDenseArray(numStates);

      // Verify holding time section: states 0-5, each with 10080 values
      for (let state = 0; state < numStates; state++) {
        const firstIndex = holdIndex(state, 0, 0);
        const lastIndex = holdIndex(state, 4, 2015);
        expect(firstIndex).toBe(state * VALUES_PER_BUCKET_GROUP);
        expect(lastIndex).toBe(
          state * VALUES_PER_BUCKET_GROUP + 4 * BUCKETS_PER_WEEK + 2015,
        );
      }

      // Verify transition section starts after holding times
      const firstTransIndex = transIndex(0, 1, 0, 0, numStates);
      expect(firstTransIndex).toBe(numStates * VALUES_PER_BUCKET_GROUP);

      // Verify last transition index
      const lastTransIndex = transIndex(5, 4, 4, 2015, numStates);
      expect(lastTransIndex).toBe(array.length - 1);
    });
  });
});

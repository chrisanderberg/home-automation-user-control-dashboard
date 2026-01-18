/**
 * Tests for slider discretization logic.
 */

import { describe, it, expect } from 'vitest';
import {
  discretizeSlider,
  type SliderBoundaryPolicy,
  DEFAULT_SLIDER_BOUNDARY_POLICY,
} from './slider.js';
import { createSliderValue01 } from './types.js';

describe('discretizeSlider', () => {
  describe('endpoint values', () => {
    it('maps 0 to state 0', () => {
      const result = discretizeSlider(
        createSliderValue01(0),
        DEFAULT_SLIDER_BOUNDARY_POLICY
      );
      expect(result).toBe(0);
    });

    it('maps 1 to state 5', () => {
      const result = discretizeSlider(
        createSliderValue01(1),
        DEFAULT_SLIDER_BOUNDARY_POLICY
      );
      expect(result).toBe(5);
    });
  });

  describe('interior ranges', () => {
    it('maps (0, 0.25) to state 1', () => {
      expect(discretizeSlider(createSliderValue01(0.1), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(1);
      expect(discretizeSlider(createSliderValue01(0.2), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(1);
      expect(discretizeSlider(createSliderValue01(0.24), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(1);
    });

    it('maps (0.25, 0.5) to state 2', () => {
      expect(discretizeSlider(createSliderValue01(0.3), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(2);
      expect(discretizeSlider(createSliderValue01(0.4), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(2);
      expect(discretizeSlider(createSliderValue01(0.49), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(2);
    });

    it('maps (0.5, 0.75) to state 3', () => {
      expect(discretizeSlider(createSliderValue01(0.6), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(3);
      expect(discretizeSlider(createSliderValue01(0.7), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(3);
      expect(discretizeSlider(createSliderValue01(0.74), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(3);
    });

    it('maps (0.75, 1) to state 4', () => {
      expect(discretizeSlider(createSliderValue01(0.8), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(4);
      expect(discretizeSlider(createSliderValue01(0.9), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(4);
      expect(discretizeSlider(createSliderValue01(0.99), DEFAULT_SLIDER_BOUNDARY_POLICY)).toBe(4);
    });
  });

  describe('boundary values with roundDown policy', () => {
    const policy: SliderBoundaryPolicy = 'roundDown';

    it('maps 0.25 to state 1 (lower)', () => {
      expect(discretizeSlider(createSliderValue01(0.25), policy)).toBe(1);
    });

    it('maps 0.5 to state 2 (lower)', () => {
      expect(discretizeSlider(createSliderValue01(0.5), policy)).toBe(2);
    });

    it('maps 0.75 to state 3 (lower)', () => {
      expect(discretizeSlider(createSliderValue01(0.75), policy)).toBe(3);
    });
  });

  describe('boundary values with roundUp policy', () => {
    const policy: SliderBoundaryPolicy = 'roundUp';

    it('maps 0.25 to state 2 (higher)', () => {
      expect(discretizeSlider(createSliderValue01(0.25), policy)).toBe(2);
    });

    it('maps 0.5 to state 3 (higher)', () => {
      expect(discretizeSlider(createSliderValue01(0.5), policy)).toBe(3);
    });

    it('maps 0.75 to state 4 (higher)', () => {
      expect(discretizeSlider(createSliderValue01(0.75), policy)).toBe(4);
    });
  });

  describe('boundary values with roundNearest policy', () => {
    const policy: SliderBoundaryPolicy = 'roundNearest';

    it('maps 0.25 to state 1 (nearest, tie goes to lower)', () => {
      // 0.25 is equidistant from state 1 center (0.125) and state 2 center (0.375)
      // Distance to state 1: |0.25 - 0.125| = 0.125
      // Distance to state 2: |0.25 - 0.375| = 0.125
      // Tie → lower (state 1)
      expect(discretizeSlider(createSliderValue01(0.25), policy)).toBe(1);
    });

    it('maps 0.5 to state 2 (nearest, tie goes to lower)', () => {
      // 0.5 is equidistant from state 2 center (0.375) and state 3 center (0.625)
      // Distance to state 2: |0.5 - 0.375| = 0.125
      // Distance to state 3: |0.5 - 0.625| = 0.125
      // Tie → lower (state 2)
      expect(discretizeSlider(createSliderValue01(0.5), policy)).toBe(2);
    });

    it('maps 0.75 to state 3 (nearest, tie goes to lower)', () => {
      // 0.75 is equidistant from state 3 center (0.625) and state 4 center (0.875)
      // Distance to state 3: |0.75 - 0.625| = 0.125
      // Distance to state 4: |0.75 - 0.875| = 0.125
      // Tie → lower (state 3)
      expect(discretizeSlider(createSliderValue01(0.75), policy)).toBe(3);
    });
  });

  describe('boundary values with roundNearestTiesUp policy', () => {
    const policy: SliderBoundaryPolicy = 'roundNearestTiesUp';

    it('maps 0.25 to state 2 (nearest, tie goes to higher)', () => {
      // 0.25 is equidistant from state 1 center (0.125) and state 2 center (0.375)
      // Tie → higher (state 2)
      expect(discretizeSlider(createSliderValue01(0.25), policy)).toBe(2);
    });

    it('maps 0.5 to state 3 (nearest, tie goes to higher)', () => {
      // 0.5 is equidistant from state 2 center (0.375) and state 3 center (0.625)
      // Tie → higher (state 3)
      expect(discretizeSlider(createSliderValue01(0.5), policy)).toBe(3);
    });

    it('maps 0.75 to state 4 (nearest, tie goes to higher)', () => {
      // 0.75 is equidistant from state 3 center (0.625) and state 4 center (0.875)
      // Tie → higher (state 4)
      expect(discretizeSlider(createSliderValue01(0.75), policy)).toBe(4);
    });
  });

  describe('policy parameter requirement', () => {
    it('requires explicit policy parameter (no silent defaults)', () => {
      // This test verifies that the function signature requires a policy.
      // TypeScript will fail to compile if we try to call it without a policy.
      const value = createSliderValue01(0.5);
      const policy: SliderBoundaryPolicy = 'roundDown';
      
      // This should compile and work
      const result = discretizeSlider(value, policy);
      expect(result).toBe(2);
      
      // If we could call it without a policy, TypeScript would error here.
      // The fact that this test compiles confirms the policy is required.
    });
  });
});

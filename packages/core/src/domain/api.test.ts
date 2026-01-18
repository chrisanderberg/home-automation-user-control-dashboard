/**
 * Tests for API input shapes.
 */

import { describe, it, expect } from 'vitest';
import {
  setControlValueRequestSchema,
  type SetControlValueRequest,
} from './api.js';
import { createSliderValue01 } from './types.js';

describe('setControlValueRequestSchema', () => {
  describe('radiobutton requests', () => {
    it('accepts valid radiobutton request', () => {
      const valid: SetControlValueRequest = {
        controlId: 'control-1' as any,
        initiator: 'user',
        isCommitted: true,
        kind: 'radiobutton',
        newState: 2,
      };
      expect(setControlValueRequestSchema.parse(valid)).toEqual(valid);
    });

    it('accepts model-initiated radiobutton request', () => {
      const valid: SetControlValueRequest = {
        controlId: 'control-1' as any,
        initiator: 'model',
        isCommitted: false,
        kind: 'radiobutton',
        newState: 0,
      };
      expect(setControlValueRequestSchema.parse(valid)).toEqual(valid);
    });

    it('rejects invalid initiator', () => {
      const invalid = {
        controlId: 'control-1',
        initiator: 'invalid',
        isCommitted: true,
        kind: 'radiobutton',
        newState: 2,
      };
      expect(() => setControlValueRequestSchema.parse(invalid)).toThrow();
    });

    it('rejects missing required fields', () => {
      const invalid1 = {
        controlId: 'control-1',
        initiator: 'user',
        // missing isCommitted
        kind: 'radiobutton',
        newState: 2,
      };
      expect(() => setControlValueRequestSchema.parse(invalid1)).toThrow();

      const invalid2 = {
        // missing controlId
        initiator: 'user',
        isCommitted: true,
        kind: 'radiobutton',
        newState: 2,
      };
      expect(() => setControlValueRequestSchema.parse(invalid2)).toThrow();
    });

    it('rejects empty controlId', () => {
      const invalid = {
        controlId: '',
        initiator: 'user',
        isCommitted: true,
        kind: 'radiobutton',
        newState: 2,
      };
      expect(() => setControlValueRequestSchema.parse(invalid)).toThrow();
    });

    it('rejects non-integer newState', () => {
      const invalid = {
        controlId: 'control-1',
        initiator: 'user',
        isCommitted: true,
        kind: 'radiobutton',
        newState: 2.5,
      };
      expect(() => setControlValueRequestSchema.parse(invalid)).toThrow();
    });
  });

  describe('slider requests', () => {
    it('accepts valid slider request', () => {
      const valid: SetControlValueRequest = {
        controlId: 'control-1' as any,
        initiator: 'user',
        isCommitted: true,
        kind: 'slider',
        newValue01: createSliderValue01(0.5),
      };
      expect(setControlValueRequestSchema.parse(valid)).toEqual(valid);
    });

    it('accepts uncommitted slider request', () => {
      const valid: SetControlValueRequest = {
        controlId: 'control-1' as any,
        initiator: 'model',
        isCommitted: false,
        kind: 'slider',
        newValue01: createSliderValue01(0.75),
      };
      expect(setControlValueRequestSchema.parse(valid)).toEqual(valid);
    });

    it('rejects invalid initiator', () => {
      const invalid = {
        controlId: 'control-1',
        initiator: 'invalid',
        isCommitted: true,
        kind: 'slider',
        newValue01: 0.5,
      };
      expect(() => setControlValueRequestSchema.parse(invalid)).toThrow();
    });

    it('rejects missing required fields', () => {
      const invalid1 = {
        controlId: 'control-1',
        initiator: 'user',
        // missing isCommitted
        kind: 'slider',
        newValue01: 0.5,
      };
      expect(() => setControlValueRequestSchema.parse(invalid1)).toThrow();

      const invalid2 = {
        controlId: 'control-1',
        initiator: 'user',
        isCommitted: true,
        kind: 'slider',
        // missing newValue01
      };
      expect(() => setControlValueRequestSchema.parse(invalid2)).toThrow();
    });

    it('rejects invalid newValue01 (< 0)', () => {
      const invalid = {
        controlId: 'control-1',
        initiator: 'user',
        isCommitted: true,
        kind: 'slider',
        newValue01: -0.1,
      };
      expect(() => setControlValueRequestSchema.parse(invalid)).toThrow();
    });

    it('rejects invalid newValue01 (> 1)', () => {
      const invalid = {
        controlId: 'control-1',
        initiator: 'user',
        isCommitted: true,
        kind: 'slider',
        newValue01: 1.1,
      };
      expect(() => setControlValueRequestSchema.parse(invalid)).toThrow();
    });
  });

  describe('kind mismatch', () => {
    it('rejects radiobutton kind with slider fields', () => {
      const invalid = {
        controlId: 'control-1',
        initiator: 'user',
        isCommitted: true,
        kind: 'radiobutton',
        newValue01: 0.5, // slider field
      };
      expect(() => setControlValueRequestSchema.parse(invalid)).toThrow();
    });

    it('rejects slider kind with radiobutton fields', () => {
      const invalid = {
        controlId: 'control-1',
        initiator: 'user',
        isCommitted: true,
        kind: 'slider',
        newState: 2, // radiobutton field
      };
      expect(() => setControlValueRequestSchema.parse(invalid)).toThrow();
    });
  });
});

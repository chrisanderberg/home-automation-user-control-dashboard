/**
 * Tests for Zod validation schemas.
 */

import { describe, it, expect } from 'vitest';
import {
  controlIdSchema,
  modelIdSchema,
  sliderValue01Schema,
  radiobuttonDefinitionSchema,
  sliderDefinitionSchema,
  controlDefinitionSchema,
  discreteStateSchema,
} from './validation.js';
import type { ControlDefinition } from './types.js';

describe('controlIdSchema', () => {
  it('accepts non-empty strings', () => {
    expect(controlIdSchema.parse('control-1')).toBe('control-1');
    expect(controlIdSchema.parse('abc')).toBe('abc');
  });

  it('rejects empty strings', () => {
    expect(() => controlIdSchema.parse('')).toThrow();
  });

  it('rejects non-strings', () => {
    expect(() => controlIdSchema.parse(123)).toThrow();
    expect(() => controlIdSchema.parse(null)).toThrow();
  });
});

describe('modelIdSchema', () => {
  it('accepts non-empty strings', () => {
    expect(modelIdSchema.parse('model-1')).toBe('model-1');
  });

  it('rejects empty strings', () => {
    expect(() => modelIdSchema.parse('')).toThrow();
  });
});

describe('sliderValue01Schema', () => {
  it('accepts values in [0, 1]', () => {
    expect(sliderValue01Schema.parse(0)).toBe(0);
    expect(sliderValue01Schema.parse(1)).toBe(1);
    expect(sliderValue01Schema.parse(0.5)).toBe(0.5);
    expect(sliderValue01Schema.parse(0.25)).toBe(0.25);
  });

  it('rejects values < 0', () => {
    expect(() => sliderValue01Schema.parse(-0.1)).toThrow();
    expect(() => sliderValue01Schema.parse(-1)).toThrow();
  });

  it('rejects values > 1', () => {
    expect(() => sliderValue01Schema.parse(1.1)).toThrow();
    expect(() => sliderValue01Schema.parse(2)).toThrow();
  });

  it('rejects non-numbers', () => {
    expect(() => sliderValue01Schema.parse('0.5')).toThrow();
    expect(() => sliderValue01Schema.parse(null)).toThrow();
  });
});

describe('radiobuttonDefinitionSchema', () => {
  it('accepts valid radiobutton definitions', () => {
    const valid = {
      kind: 'radiobutton' as const,
      numStates: 2,
      labels: ['Off', 'On'],
    };
    expect(radiobuttonDefinitionSchema.parse(valid)).toEqual(valid);
  });

  it('rejects numStates < 2', () => {
    const invalid = {
      kind: 'radiobutton' as const,
      numStates: 1,
      labels: ['Only'],
    };
    expect(() => radiobuttonDefinitionSchema.parse(invalid)).toThrow();
  });

  it('rejects numStates > 10', () => {
    const invalid = {
      kind: 'radiobutton' as const,
      numStates: 11,
      labels: Array(11).fill('State'),
    };
    expect(() => radiobuttonDefinitionSchema.parse(invalid)).toThrow();
  });

  it('rejects when labels.length !== numStates', () => {
    const invalid1 = {
      kind: 'radiobutton' as const,
      numStates: 3,
      labels: ['A', 'B'], // only 2 labels
    };
    expect(() => radiobuttonDefinitionSchema.parse(invalid1)).toThrow();

    const invalid2 = {
      kind: 'radiobutton' as const,
      numStates: 2,
      labels: ['A', 'B', 'C'], // 3 labels
    };
    expect(() => radiobuttonDefinitionSchema.parse(invalid2)).toThrow();
  });

  it('accepts numStates in range [2, 10]', () => {
    for (let n = 2; n <= 10; n++) {
      const valid = {
        kind: 'radiobutton' as const,
        numStates: n,
        labels: Array(n).fill(`State`),
      };
      expect(radiobuttonDefinitionSchema.parse(valid)).toEqual(valid);
    }
  });
});

describe('sliderDefinitionSchema', () => {
  it('accepts slider definition without labels', () => {
    const valid = {
      kind: 'slider' as const,
    };
    expect(sliderDefinitionSchema.parse(valid)).toEqual(valid);
  });

  it('accepts slider definition with exactly 6 labels', () => {
    const valid = {
      kind: 'slider' as const,
      labels: ['Dim', 'Low', 'Medium', 'High', 'Very High', 'Bright'],
    };
    expect(sliderDefinitionSchema.parse(valid)).toEqual(valid);
  });

  it('rejects slider definition with wrong number of labels', () => {
    const invalid1 = {
      kind: 'slider' as const,
      labels: ['A', 'B'], // only 2 labels
    };
    expect(() => sliderDefinitionSchema.parse(invalid1)).toThrow();

    const invalid2 = {
      kind: 'slider' as const,
      labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], // 7 labels
    };
    expect(() => sliderDefinitionSchema.parse(invalid2)).toThrow();
  });
});

describe('controlDefinitionSchema', () => {
  it('accepts valid radiobutton definition', () => {
    const valid = {
      kind: 'radiobutton' as const,
      numStates: 3,
      labels: ['Off', 'Auto', 'On'],
    };
    expect(controlDefinitionSchema.parse(valid)).toEqual(valid);
  });

  it('accepts valid slider definition', () => {
    const valid = {
      kind: 'slider' as const,
    };
    expect(controlDefinitionSchema.parse(valid)).toEqual(valid);
  });

  it('rejects invalid kind', () => {
    const invalid = {
      kind: 'invalid' as any,
      numStates: 2,
      labels: ['A', 'B'],
    };
    expect(() => controlDefinitionSchema.parse(invalid)).toThrow();
  });
});

describe('discreteStateSchema', () => {
  describe('for radiobutton', () => {
    const definition: ControlDefinition = {
      kind: 'radiobutton',
      numStates: 5,
      labels: ['A', 'B', 'C', 'D', 'E'],
    };
    const schema = discreteStateSchema(definition);

    it('accepts states in [0, numStates-1]', () => {
      expect(schema.parse(0)).toBe(0);
      expect(schema.parse(2)).toBe(2);
      expect(schema.parse(4)).toBe(4);
    });

    it('rejects states < 0', () => {
      expect(() => schema.parse(-1)).toThrow();
    });

    it('rejects states >= numStates', () => {
      expect(() => schema.parse(5)).toThrow();
      expect(() => schema.parse(10)).toThrow();
    });

    it('rejects non-integers', () => {
      expect(() => schema.parse(1.5)).toThrow();
      expect(() => schema.parse(2.7)).toThrow();
    });
  });

  describe('for slider', () => {
    const definition: ControlDefinition = {
      kind: 'slider',
    };
    const schema = discreteStateSchema(definition);

    it('accepts states in [0, 5]', () => {
      expect(schema.parse(0)).toBe(0);
      expect(schema.parse(3)).toBe(3);
      expect(schema.parse(5)).toBe(5);
    });

    it('rejects states < 0', () => {
      expect(() => schema.parse(-1)).toThrow();
    });

    it('rejects states > 5', () => {
      expect(() => schema.parse(6)).toThrow();
      expect(() => schema.parse(10)).toThrow();
    });

    it('rejects non-integers', () => {
      expect(() => schema.parse(1.5)).toThrow();
    });
  });
});

import { describe, it, expect } from 'vitest';
import { hello } from './index';

describe('core package', () => {
  it('exports hello function', () => {
    expect(hello()).toBe('Hello from core');
  });
});

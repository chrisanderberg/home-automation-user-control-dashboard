import { describe, it, expect } from 'vitest';
import {
  BUCKET_MINUTES,
  BUCKETS_PER_DAY,
  BUCKETS_PER_WEEK,
  MIN_BUCKET_ID,
  MAX_BUCKET_ID,
} from './constants.js';

describe('time constants', () => {
  it('BUCKET_MINUTES should be 5', () => {
    expect(BUCKET_MINUTES).toBe(5);
  });

  it('BUCKETS_PER_DAY should be 288', () => {
    expect(BUCKETS_PER_DAY).toBe(288);
    // Verify: 24 hours × 12 buckets/hour = 288
    expect(24 * 12).toBe(288);
  });

  it('BUCKETS_PER_WEEK should be 2016', () => {
    expect(BUCKETS_PER_WEEK).toBe(2016);
    // Verify: 7 days × 288 buckets/day = 2016
    expect(7 * 288).toBe(2016);
  });

  it('MIN_BUCKET_ID should be 0', () => {
    expect(MIN_BUCKET_ID).toBe(0);
  });

  it('MAX_BUCKET_ID should be 2015', () => {
    expect(MAX_BUCKET_ID).toBe(2015);
    // Verify: BUCKETS_PER_WEEK - 1 = 2015
    expect(BUCKETS_PER_WEEK - 1).toBe(2015);
  });
});

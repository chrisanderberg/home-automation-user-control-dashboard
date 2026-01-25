import { describe, it, expect } from 'vitest';
import {
  bucketIdToDayAndMinutes,
  dayAndMinutesToBucketId,
  cyclicDistance,
} from './bucket.js';
import { MAX_BUCKET_ID, MIN_BUCKET_ID } from './constants.js';

describe('bucketIdToDayAndMinutes', () => {
  it('should convert Monday 00:00 (bucket 0)', () => {
    const result = bucketIdToDayAndMinutes(0);
    expect(result).toEqual({
      dayOfWeek: 0,
      startMinute: 0,
      endMinute: 5,
    });
  });

  it('should convert Sunday 23:55 (bucket 2015)', () => {
    const result = bucketIdToDayAndMinutes(2015);
    expect(result).toEqual({
      dayOfWeek: 6,
      startMinute: 1435,
      endMinute: 1440,
    });
  });

  it('should convert Wednesday 12:00 (bucket 720)', () => {
    // Wednesday is day 2, 12:00 = 720 minutes = bucket 144 in day
    // bucketId = 2 * 288 + 144 = 720
    // Actually, 12:00 = 720 minutes = bucket 144 (720 / 5 = 144)
    // bucketId = 2 * 288 + 144 = 720
    const result = bucketIdToDayAndMinutes(720);
    expect(result).toEqual({
      dayOfWeek: 2,
      startMinute: 720,
      endMinute: 725,
    });
  });

  it('should convert boundary cases', () => {
    // Last bucket of Monday (bucket 287)
    const mondayLast = bucketIdToDayAndMinutes(287);
    expect(mondayLast).toEqual({
      dayOfWeek: 0,
      startMinute: 1435,
      endMinute: 1440,
    });

    // First bucket of Tuesday (bucket 288)
    const tuesdayFirst = bucketIdToDayAndMinutes(288);
    expect(tuesdayFirst).toEqual({
      dayOfWeek: 1,
      startMinute: 0,
      endMinute: 5,
    });
  });

  it('should throw for bucketId < 0', () => {
    expect(() => bucketIdToDayAndMinutes(-1)).toThrow(
      'bucketId must be an integer in range [0, 2015]',
    );
  });

  it('should throw for bucketId > 2015', () => {
    expect(() => bucketIdToDayAndMinutes(2016)).toThrow(
      'bucketId must be an integer in range [0, 2015]',
    );
  });

  it('should throw for non-integer bucketId', () => {
    expect(() => bucketIdToDayAndMinutes(100.5)).toThrow();
  });
});

describe('dayAndMinutesToBucketId', () => {
  it('should convert Monday 00:00 to bucket 0', () => {
    expect(dayAndMinutesToBucketId(0, 0)).toBe(0);
  });

  it('should convert Sunday 23:55 to bucket 2015', () => {
    expect(dayAndMinutesToBucketId(6, 1435)).toBe(2015);
  });

  it('should round down minutes correctly', () => {
    // 00:03 should map to bucket 0 (0-4 minutes)
    expect(dayAndMinutesToBucketId(0, 3)).toBe(0);
    // 00:07 should map to bucket 1 (5-9 minutes)
    expect(dayAndMinutesToBucketId(0, 7)).toBe(1);
    // 00:05 should map to bucket 1 (5-9 minutes)
    expect(dayAndMinutesToBucketId(0, 5)).toBe(1);
    // 00:04 should map to bucket 0 (0-4 minutes)
    expect(dayAndMinutesToBucketId(0, 4)).toBe(0);
  });

  it('should handle mid-day times', () => {
    // Wednesday 12:00 = day 2, 720 minutes
    expect(dayAndMinutesToBucketId(2, 720)).toBe(720);
  });

  it('should throw for invalid dayOfWeek', () => {
    expect(() => dayAndMinutesToBucketId(-1, 0)).toThrow(
      'dayOfWeek must be an integer in range [0, 6]',
    );
    expect(() => dayAndMinutesToBucketId(7, 0)).toThrow(
      'dayOfWeek must be an integer in range [0, 6]',
    );
    expect(() => dayAndMinutesToBucketId(3.5, 0)).toThrow();
  });

  it('should throw for invalid minutesIntoDay', () => {
    expect(() => dayAndMinutesToBucketId(0, -1)).toThrow(
      'minutesIntoDay must be an integer in range [0, 1439]',
    );
    expect(() => dayAndMinutesToBucketId(0, 1440)).toThrow(
      'minutesIntoDay must be an integer in range [0, 1439]',
    );
    expect(() => dayAndMinutesToBucketId(0, 100.5)).toThrow();
  });
});

describe('cyclicDistance', () => {
  it('should return 0 for same bucket', () => {
    expect(cyclicDistance(100, 100)).toBe(0);
    expect(cyclicDistance(0, 0)).toBe(0);
    expect(cyclicDistance(2015, 2015)).toBe(0);
  });

  it('should compute forward distance for adjacent buckets', () => {
    expect(cyclicDistance(0, 1)).toBe(1);
    expect(cyclicDistance(100, 101)).toBe(1);
  });

  it('should compute backward distance', () => {
    expect(cyclicDistance(100, 0)).toBe(-100);
    expect(cyclicDistance(50, 10)).toBe(-40);
  });

  it('should handle wrap: Sunday end to Monday start', () => {
    // Sunday 23:55 (2015) to Monday 00:00 (0) is +1 forward
    expect(cyclicDistance(2015, 0)).toBe(1);
  });

  it('should handle wrap: Monday start to Sunday end', () => {
    // Monday 00:00 (0) to Sunday 23:55 (2015) is -1 backward (shorter)
    expect(cyclicDistance(0, 2015)).toBe(-1);
  });

  it('should handle mid-week wrap cases', () => {
    // From Sunday 23:55 (2015) to Tuesday 00:05 (289) forward is shorter
    // Forward: 289 - 2015 = -1726, normalized: -1726 + 2016 = 290
    // Backward: 2015 - 289 = 1726
    // Forward is shorter, so distance = 290 (but we want shortest path)
    // Actually, going backward: 2015 -> 0 -> 1 -> ... -> 289 is 290 steps
    // Going forward: 2015 -> 0 -> 1 -> ... -> 289 is 290 steps (wrapping)
    // Wait, let me recalculate:
    // From 2015 to 289:
    //   Forward: (289 - 2015) mod 2016 = (-1726) mod 2016 = 290
    //   Backward: (2015 - 289) = 1726
    // Forward is shorter, so result should be 290
    // But the function should return the signed shortest path
    // Actually, 290 steps forward, or 1726 steps backward
    // Shortest is 290 forward, but we need to check the implementation
    
    // Let's test: from 2015 to 1
    // Forward: (1 - 2015) = -2014, normalized: -2014 + 2016 = 2
    // Backward: (2015 - 1) = 2014
    // Forward is shorter, so result = 2
    expect(cyclicDistance(2015, 1)).toBe(2);
    
    // From 1 to 2015:
    // Forward: (2015 - 1) = 2014
    // Backward: (1 - 2015) = -2014, normalized: -2014 + 2016 = 2
    // Backward is shorter, so result = -2
    expect(cyclicDistance(1, 2015)).toBe(-2);
  });

  it('should compute maximum forward distance (half week)', () => {
    // From 0 to 1008 (exactly half week forward)
    expect(cyclicDistance(0, 1008)).toBe(1008);
  });

  it('should wrap for distances > half week', () => {
    // From 0 to 1009: forward is 1009, backward is 1007 (shorter)
    // So result should be -1007
    expect(cyclicDistance(0, 1009)).toBe(-1007);
  });

  it('should throw for invalid bucketId1', () => {
    expect(() => cyclicDistance(-1, 0)).toThrow(
      'bucketId1 must be an integer in range [0, 2015]',
    );
    expect(() => cyclicDistance(2016, 0)).toThrow();
  });

  it('should throw for invalid bucketId2', () => {
    expect(() => cyclicDistance(0, -1)).toThrow(
      'bucketId2 must be an integer in range [0, 2015]',
    );
    expect(() => cyclicDistance(0, 2016)).toThrow();
  });

  it('should handle various forward distances', () => {
    expect(cyclicDistance(0, 100)).toBe(100);
    expect(cyclicDistance(500, 600)).toBe(100);
    expect(cyclicDistance(1000, 1100)).toBe(100);
  });

  it('should handle various backward distances', () => {
    expect(cyclicDistance(100, 0)).toBe(-100);
    expect(cyclicDistance(600, 500)).toBe(-100);
    expect(cyclicDistance(1100, 1000)).toBe(-100);
  });
});

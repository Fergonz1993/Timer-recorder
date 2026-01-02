import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatDurationClock,
  formatBar,
} from '../../src/cli/utils/format.js';

describe('formatDuration', () => {
  it('should format seconds only', () => {
    expect(formatDuration(30)).toBe('30s');
    expect(formatDuration(59)).toBe('59s');
  });

  it('should format minutes and seconds', () => {
    expect(formatDuration(60)).toBe('1m 00s');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(125)).toBe('2m 05s');
    expect(formatDuration(3599)).toBe('59m 59s');
  });

  it('should format hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1h 00m');
    expect(formatDuration(3660)).toBe('1h 01m');
    expect(formatDuration(7200)).toBe('2h 00m');
    expect(formatDuration(7323)).toBe('2h 02m');
    expect(formatDuration(36000)).toBe('10h 00m');
  });

  it('should handle zero', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('should handle negative values as zero', () => {
    expect(formatDuration(-100)).toBe('0s');
  });
});

describe('formatDurationClock', () => {
  it('should format as HH:MM:SS', () => {
    expect(formatDurationClock(0)).toBe('00:00:00');
    expect(formatDurationClock(30)).toBe('00:00:30');
    expect(formatDurationClock(90)).toBe('00:01:30');
    expect(formatDurationClock(3600)).toBe('01:00:00');
    expect(formatDurationClock(3661)).toBe('01:01:01');
    expect(formatDurationClock(36000)).toBe('10:00:00');
  });

  it('should handle negative values as zero', () => {
    expect(formatDurationClock(-100)).toBe('00:00:00');
  });
});

describe('formatBar', () => {
  it('should create progress bar at various percentages', () => {
    // 0% should be all empty
    const bar0 = formatBar(0, 10);
    expect(bar0).toContain('░'.repeat(10));

    // 50% should be half filled
    const bar50 = formatBar(50, 10);
    expect(bar50).toContain('█'.repeat(5));

    // 100% should be all filled
    const bar100 = formatBar(100, 10);
    expect(bar100).toContain('█'.repeat(10));
  });

  it('should use default width of 20', () => {
    const bar = formatBar(50);
    // Should contain 10 filled blocks (50% of 20)
    const filledCount = (bar.match(/█/g) || []).length;
    expect(filledCount).toBe(10);
  });

});

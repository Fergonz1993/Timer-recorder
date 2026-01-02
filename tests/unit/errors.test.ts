import { describe, it, expect } from 'vitest';
import {
  TimerRecordError,
  CategoryNotFoundError,
  EntryNotFoundError,
  NoActiveTimerError,
  PermissionError,
  ValidationError,
  DatabaseError,
  GoalNotFoundError,
} from '../../src/errors/index.js';

describe('TimerRecordError', () => {
  it('should create error with message and code', () => {
    const error = new TimerRecordError('Test error', 'TEST_CODE');
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('TimerRecordError');
  });

  it('should include details when provided', () => {
    const error = new TimerRecordError('Test error', 'TEST_CODE', { foo: 'bar' });
    expect(error.details).toEqual({ foo: 'bar' });
  });

  it('should be instanceof Error', () => {
    const error = new TimerRecordError('Test', 'TEST');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TimerRecordError);
  });
});

describe('CategoryNotFoundError', () => {
  it('should create error with category name', () => {
    const error = new CategoryNotFoundError('programming');
    expect(error.message).toBe('Category not found: programming');
    expect(error.code).toBe('CATEGORY_NOT_FOUND');
    expect(error.details).toEqual({ categoryName: 'programming' });
  });
});

describe('EntryNotFoundError', () => {
  it('should create error with entry ID', () => {
    const error = new EntryNotFoundError(123);
    expect(error.message).toBe('Entry not found: 123');
    expect(error.code).toBe('ENTRY_NOT_FOUND');
    expect(error.details).toEqual({ entryId: 123 });
  });
});

describe('NoActiveTimerError', () => {
  it('should create error with standard message', () => {
    const error = new NoActiveTimerError();
    expect(error.message).toBe('No active timer running');
    expect(error.code).toBe('NO_ACTIVE_TIMER');
  });
});

describe('PermissionError', () => {
  it('should create error with permission message', () => {
    const error = new PermissionError();
    expect(error.message).toContain('Accessibility permission');
    expect(error.code).toBe('PERMISSION_DENIED');
  });
});

describe('ValidationError', () => {
  it('should create error with message', () => {
    const error = new ValidationError('Invalid input');
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('should include field when provided', () => {
    const error = new ValidationError('Invalid input', 'duration');
    expect(error.details).toEqual({ field: 'duration' });
  });
});

describe('DatabaseError', () => {
  it('should create error with operation', () => {
    const error = new DatabaseError('Query failed', 'SELECT');
    expect(error.message).toBe('Query failed');
    expect(error.code).toBe('DATABASE_ERROR');
    expect(error.details?.operation).toBe('SELECT');
  });

  it('should include cause when provided', () => {
    const cause = new Error('Connection lost');
    const error = new DatabaseError('Query failed', 'SELECT', cause);
    expect(error.details?.cause).toBe('Connection lost');
  });
});

describe('GoalNotFoundError', () => {
  it('should create error with category name', () => {
    const error = new GoalNotFoundError('programming');
    expect(error.message).toBe('No goal found for: programming');
    expect(error.code).toBe('GOAL_NOT_FOUND');
  });

  it('should include period when provided', () => {
    const error = new GoalNotFoundError('programming', 'weekly');
    expect(error.message).toBe('No weekly goal found for: programming');
    expect(error.details).toEqual({ categoryName: 'programming', period: 'weekly' });
  });
});

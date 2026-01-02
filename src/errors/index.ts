/**
 * Base error class for Timer Record
 */
export class TimerRecordError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TimerRecordError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Category not found error
 */
export class CategoryNotFoundError extends TimerRecordError {
  constructor(categoryName: string) {
    super(
      `Category not found: ${categoryName}`,
      'CATEGORY_NOT_FOUND',
      { categoryName }
    );
    this.name = 'CategoryNotFoundError';
  }
}

/**
 * Entry not found error
 */
export class EntryNotFoundError extends TimerRecordError {
  constructor(entryId: number) {
    super(
      `Entry not found: ${entryId}`,
      'ENTRY_NOT_FOUND',
      { entryId }
    );
    this.name = 'EntryNotFoundError';
  }
}

/**
 * No active timer error
 */
export class NoActiveTimerError extends TimerRecordError {
  constructor() {
    super(
      'No active timer running',
      'NO_ACTIVE_TIMER'
    );
    this.name = 'NoActiveTimerError';
  }
}

/**
 * Timer already running error
 */
export class TimerAlreadyRunningError extends TimerRecordError {
  constructor(categoryName?: string) {
    super(
      categoryName
        ? `Timer already running for: ${categoryName}`
        : 'A timer is already running',
      'TIMER_ALREADY_RUNNING',
      categoryName ? { categoryName } : undefined
    );
    this.name = 'TimerAlreadyRunningError';
  }
}

/**
 * Detection error (AppleScript or permission issues)
 */
export class DetectionError extends TimerRecordError {
  constructor(message: string, cause?: Error) {
    super(
      message,
      'DETECTION_FAILED',
      cause ? { cause: cause.message } : undefined
    );
    this.name = 'DetectionError';
  }
}

/**
 * Accessibility permission error
 */
export class PermissionError extends TimerRecordError {
  constructor() {
    super(
      'Accessibility permission not granted. Window title detection requires accessibility access.',
      'PERMISSION_DENIED'
    );
    this.name = 'PermissionError';
  }
}

/**
 * Database error
 */
export class DatabaseError extends TimerRecordError {
  constructor(message: string, operation: string, cause?: Error) {
    super(
      message,
      'DATABASE_ERROR',
      { operation, cause: cause?.message }
    );
    this.name = 'DatabaseError';
  }
}

/**
 * Validation error for user input
 */
export class ValidationError extends TimerRecordError {
  constructor(message: string, field?: string) {
    super(
      message,
      'VALIDATION_ERROR',
      field ? { field } : undefined
    );
    this.name = 'ValidationError';
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends TimerRecordError {
  constructor(message: string, key?: string) {
    super(
      message,
      'CONFIGURATION_ERROR',
      key ? { key } : undefined
    );
    this.name = 'ConfigurationError';
  }
}

/**
 * Goal not found error
 */
export class GoalNotFoundError extends TimerRecordError {
  constructor(categoryName: string, period?: string) {
    super(
      period
        ? `No ${period} goal found for: ${categoryName}`
        : `No goal found for: ${categoryName}`,
      'GOAL_NOT_FOUND',
      { categoryName, period }
    );
    this.name = 'GoalNotFoundError';
  }
}

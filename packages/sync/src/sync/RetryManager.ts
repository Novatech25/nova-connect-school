import { OfflineOperation } from '../queue/OfflineQueue';

export interface RetrySchedule {
  operationId: string;
  retryCount: number;
  nextRetryAt: Date;
  error: string;
}

export class RetryManager {
  private baseDelay: number; // milliseconds
  private maxRetries: number;
  private maxDelay: number; // maximum delay cap (e.g., 5 minutes)
  private retrySchedules: Map<string, RetrySchedule> = new Map();

  constructor(
    baseDelay: number = 1000, // 1 second
    maxRetries: number = 5,
    maxDelay: number = 300000 // 5 minutes
  ) {
    this.baseDelay = baseDelay;
    this.maxRetries = maxRetries;
    this.maxDelay = maxDelay;
  }

  /**
   * Calculate next retry delay using exponential backoff with jitter
   * Formula: delay = min(baseDelay * 2^retryCount, maxDelay) * (0.5 + Math.random() * 0.5)
   */
  private calculateDelay(retryCount: number): number {
    // Exponential backoff
    const exponentialDelay = this.baseDelay * Math.pow(2, retryCount);

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.maxDelay);

    // Add jitter to avoid thundering herd (random between 0.5x and 1x)
    const jitter = 0.5 + Math.random() * 0.5;
    const finalDelay = Math.floor(cappedDelay * jitter);

    return finalDelay;
  }

  /**
   * Schedule a retry for a failed operation
   */
  scheduleRetry(operation: OfflineOperation, error: Error): RetrySchedule {
    const delay = this.calculateDelay(operation.retryCount);
    const nextRetryAt = new Date(Date.now() + delay);

    const schedule: RetrySchedule = {
      operationId: operation.id,
      retryCount: operation.retryCount,
      nextRetryAt,
      error: error.message,
    };

    this.retrySchedules.set(operation.id, schedule);

    console.log(
      `[RetryManager] Scheduled retry for operation ${operation.id} ` +
      `(attempt ${operation.retryCount + 1}/${this.maxRetries}) ` +
      `in ${Math.round(delay / 1000)}s - ${error.message}`
    );

    return schedule;
  }

  /**
   * Check if an operation should be retried
   */
  shouldRetry(operation: OfflineOperation, error: Error): boolean {
    // Don't retry if max retries exceeded
    if (operation.retryCount >= this.maxRetries) {
      return false;
    }

    // Don't retry validation errors
    if (this.isValidationError(error)) {
      return false;
    }

    // Retry network errors, timeouts, and server errors (5xx)
    return this.isRetriableError(error);
  }

  /**
   * Check if error is retriable
   */
  private isRetriableError(error: any): boolean {
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return true;
    }

    // Timeout errors
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      return true;
    }

    // HTTP status codes
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      // Retry on 408 (Request Timeout), 429 (Too Many Requests), 5xx (Server Errors)
      return status === 408 || status === 429 || status >= 500;
    }

    // Supabase-specific errors
    if (error.code) {
      // Retry on connection errors
      if (error.code === 'PGRST116' || error.code === 'PGRST000') {
        return true;
      }
    }

    // Default to retrying unknown errors
    return true;
  }

  /**
   * Check if error is a validation error (should not retry)
   */
  private isValidationError(error: any): boolean {
    // HTTP 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 422 Unprocessable Entity
    if (error.status || error.statusCode) {
      const status = error.status || error.statusCode;
      return status === 400 || status === 401 || status === 403 || status === 404 || status === 422;
    }

    // Supabase validation errors
    if (error.code) {
      return error.code.startsWith('PGRST1');
    }

    // Check error message
    const message = error.message?.toLowerCase() || '';
    return (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('not found') ||
      message.includes('unauthorized') ||
      message.includes('forbidden')
    );
  }

  /**
   * Get next retry time for an operation
   */
  getNextRetryTime(operationId: string): Date | null {
    const schedule = this.retrySchedules.get(operationId);
    return schedule?.nextRetryAt || null;
  }

  /**
   * Get all operations ready for retry
   */
  getReadyOperations(): string[] {
    const now = Date.now();
    const readyOps: string[] = [];

    for (const [operationId, schedule] of this.retrySchedules.entries()) {
      if (schedule.nextRetryAt.getTime() <= now) {
        readyOps.push(operationId);
      }
    }

    return readyOps;
  }

  /**
   * Remove retry schedule (after successful retry or max retries)
   */
  removeSchedule(operationId: string): void {
    this.retrySchedules.delete(operationId);
  }

  /**
   * Clear all retry schedules
   */
  clearAllSchedules(): void {
    this.retrySchedules.clear();
  }

  /**
   * Get all scheduled retries
   */
  getAllSchedules(): RetrySchedule[] {
    return Array.from(this.retrySchedules.values());
  }

  /**
   * Get retry statistics
   */
  getStats(): {
    totalScheduled: number;
    readyNow: number;
    byRetryCount: Record<number, number>;
  } {
    const now = Date.now();
    const byRetryCount: Record<number, number> = {};
    let readyNow = 0;

    for (const schedule of this.retrySchedules.values()) {
      byRetryCount[schedule.retryCount] = (byRetryCount[schedule.retryCount] || 0) + 1;

      if (schedule.nextRetryAt.getTime() <= now) {
        readyNow++;
      }
    }

    return {
      totalScheduled: this.retrySchedules.size,
      readyNow,
      byRetryCount,
    };
  }

  /**
   * Calculate estimated time until next retry for an operation
   */
  getTimeUntilRetry(operationId: string): number | null {
    const schedule = this.retrySchedules.get(operationId);
    if (!schedule) return null;

    const now = Date.now();
    const timeUntil = schedule.nextRetryAt.getTime() - now;

    return Math.max(0, timeUntil);
  }

  /**
   * Get human-readable retry status
   */
  getRetryStatus(operationId: string): {
    scheduled: boolean;
    retryAttempt: number | null;
    nextRetryIn: string | null;
    error: string | null;
  } {
    const schedule = this.retrySchedules.get(operationId);

    if (!schedule) {
      return {
        scheduled: false,
        retryAttempt: null,
        nextRetryIn: null,
        error: null,
      };
    }

    const timeUntil = this.getTimeUntilRetry(operationId);
    const nextRetryIn = timeUntil !== null ? this.formatDuration(timeUntil) : null;

    return {
      scheduled: true,
      retryAttempt: schedule.retryCount + 1,
      nextRetryIn,
      error: schedule.error,
    };
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Update max retries configuration
   */
  setMaxRetries(maxRetries: number): void {
    this.maxRetries = maxRetries;
  }

  /**
   * Update base delay configuration
   */
  setBaseDelay(baseDelay: number): void {
    this.baseDelay = baseDelay;
  }

  /**
   * Update max delay configuration
   */
  setMaxDelay(maxDelay: number): void {
    this.maxDelay = maxDelay;
  }
}

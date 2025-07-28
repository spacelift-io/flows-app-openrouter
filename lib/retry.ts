import { events } from "@slflows/sdk/v1";

interface RetryOptions {
  maxRetries?: number;
  maxDelay?: number;
  pendingEventId?: string;
  operationName?: string;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    maxDelay = 5000,
    pendingEventId,
    operationName = "operation",
  } = options;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (pendingEventId && attempt > 1) {
        await events.updatePending(pendingEventId, {
          statusDescription: `${operationName} (attempt ${attempt})...`,
        });
      }

      return await operation();
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if this error should be retried
      const shouldRetry =
        attempt < maxRetries &&
        // HTTP 504 Gateway Timeout
        (error.message.includes("HTTP 504") ||
          // Network errors that might be temporary
          error.message.includes("timeout") ||
          error.message.includes("ECONNRESET") ||
          error.message.includes("ENOTFOUND"));

      if (!shouldRetry) {
        throw lastError;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error(
    `${operationName} failed after ${maxRetries} attempts: ${lastError!.message}`,
  );
}

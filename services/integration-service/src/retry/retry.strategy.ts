const RETRY_DELAYS_MS: readonly number[] = [2000, 4000, 8000, 16000, 32000];

export function calculateNextRetry(retryCount: number): Date {
  const delayIndex = Math.min(retryCount, RETRY_DELAYS_MS.length - 1);
  const delayMs = RETRY_DELAYS_MS[delayIndex];
  return new Date(Date.now() + delayMs);
}

export function getMaxRetries(): number {
  return RETRY_DELAYS_MS.length;
}

export function isRetryable(retryCount: number, maxRetries: number): boolean {
  return retryCount < maxRetries;
}

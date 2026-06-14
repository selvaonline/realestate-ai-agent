/**
 * Retry a function with exponential backoff.
 * @param fn - async function to retry
 * @param opts - { maxRetries, baseDelayMs, maxDelayMs, label }
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxRetries?: number; baseDelayMs?: number; maxDelayMs?: number; label?: string } = {}
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 1000, maxDelayMs = 8000, label = 'operation' } = opts;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      if (attempt === maxRetries) break;

      const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 500, maxDelayMs);
      console.log(`[retry] ${label} attempt ${attempt + 1}/${maxRetries + 1} failed: ${e.message}. Retrying in ${Math.round(delay)}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError!;
}

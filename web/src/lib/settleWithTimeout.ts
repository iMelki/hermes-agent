/** Turn a hanging or slow promise into a settled result so a page cannot spin forever. */

export const SYSTEM_LOAD_TIMEOUT_MS = 5000;

/** Git ls-remote / fetch on the update-check path is allowed 10s server-side. */
export const UPDATE_CHECK_TIMEOUT_MS = 15000;

export function formatSettleFailure(name: string, reason: unknown): string {
  const text = reason instanceof Error ? reason.message : String(reason ?? "failed");
  if (text.includes("timeout after")) return `${name} (timeout)`;
  const status = /^(\d{3}):/.exec(text);
  if (status) return `${name} (${status[1]})`;
  return name;
}

export async function takeSettled<T>(
  name: string,
  promise: Promise<T>,
  apply: (value: T) => void,
  failed: string[],
  ms: number = SYSTEM_LOAD_TIMEOUT_MS,
): Promise<void> {
  const result = await settleWithTimeout(promise, ms);
  if (result.status === "fulfilled") apply(result.value);
  else failed.push(formatSettleFailure(name, result.reason));
}

export function settleWithTimeout<T>(
  promise: Promise<T>,
  ms: number = SYSTEM_LOAD_TIMEOUT_MS,
): Promise<PromiseSettledResult<T>> {
  return new Promise((resolve) => {
    const timer = globalThis.setTimeout(() => {
      resolve({
        status: "rejected",
        reason: new Error(`timeout after ${ms}ms`),
      });
    }, ms);
    promise.then(
      (value) => {
        globalThis.clearTimeout(timer);
        resolve({ status: "fulfilled", value });
      },
      (reason: unknown) => {
        globalThis.clearTimeout(timer);
        resolve({ status: "rejected", reason });
      },
    );
  });
}

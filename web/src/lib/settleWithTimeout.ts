/** Turn a hanging or slow promise into a settled result so a page cannot spin forever. */

export const SYSTEM_LOAD_TIMEOUT_MS = 5000;

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

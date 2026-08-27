import { afterEach, describe, expect, it, vi } from "vitest";
import { settleWithTimeout } from "./settleWithTimeout";

describe("settleWithTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fulfills when the inner promise fulfills", async () => {
    const result = await settleWithTimeout(Promise.resolve(7), 50);
    expect(result).toEqual({ status: "fulfilled", value: 7 });
  });

  it("rejects when the inner promise rejects", async () => {
    const result = await settleWithTimeout(
      Promise.reject(new Error("401: unauthorized")),
      50,
    );
    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(String(result.reason)).toContain("401");
    }
  });

  it("settles a hanging promise as rejected after the timeout", async () => {
    vi.useFakeTimers();
    const hanging = new Promise<string>(() => {});
    const pending = settleWithTimeout(hanging, 40);
    await vi.advanceTimersByTimeAsync(40);
    const result = await pending;
    expect(result.status).toBe("rejected");
    if (result.status === "rejected") {
      expect(String(result.reason)).toContain("timeout after 40ms");
    }
  });
});

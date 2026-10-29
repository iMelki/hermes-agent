import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatSettleFailure,
  settleWithTimeout,
  takeSettled,
} from "./settleWithTimeout";

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

describe("formatSettleFailure", () => {
  it("labels timeouts and HTTP status codes without inventing stats", () => {
    expect(formatSettleFailure("host stats", new Error("timeout after 5000ms"))).toBe(
      "host stats (timeout)",
    );
    expect(formatSettleFailure("portal", new Error("404: not found"))).toBe(
      "portal (404)",
    );
    expect(formatSettleFailure("memory", new Error("boom"))).toBe("memory");
  });
});

describe("takeSettled", () => {
  it("applies fulfilled values and records labeled failures", async () => {
    const failed: string[] = [];
    let value = 0;
    await takeSettled("status", Promise.resolve(3), (v) => {
      value = v;
    }, failed);
    await takeSettled(
      "host stats",
      Promise.reject(new Error("timeout after 5000ms")),
      () => {
        throw new Error("should not apply");
      },
      failed,
    );
    expect(value).toBe(3);
    expect(failed).toEqual(["host stats (timeout)"]);
  });
});

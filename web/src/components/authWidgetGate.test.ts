import { describe, expect, it } from "vitest";

import { shouldFetchAuthMe } from "./authWidgetGate";

describe("shouldFetchAuthMe", () => {
  it("skips the /api/auth/me probe in loopback", () => {
    expect(shouldFetchAuthMe(undefined)).toBe(false);
    expect(shouldFetchAuthMe(false)).toBe(false);
  });

  it("probes identity only when the OAuth gate is engaged", () => {
    expect(shouldFetchAuthMe(true)).toBe(true);
  });
});

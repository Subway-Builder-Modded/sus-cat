import { describe, expect, it } from "vitest";

import { formatDuration, MAX_TIMEOUT_MS, parseDuration } from "../src/moderation/utils/duration.js";

describe("duration parser", () => {
  it("parses compound, human-friendly durations", () => {
    expect(parseDuration("1w 2d 3h")).toBe(788_400_000);
  });

  it("enforces Discord's timeout ceiling", () => {
    expect(() => parseDuration("29d", MAX_TIMEOUT_MS)).toThrow("cannot exceed");
  });

  it("rejects incomplete and meaningless values", () => {
    expect(() => parseDuration("later")).toThrow();
    expect(() => parseDuration("0m")).toThrow();
  });

  it("formats durations concisely", () => {
    expect(formatDuration(90_000)).toBe("1 minute 30 seconds");
  });
});

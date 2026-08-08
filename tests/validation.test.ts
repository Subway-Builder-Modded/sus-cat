import { describe, expect, it } from "vitest";

import { parseSnowflake, validateReason } from "../src/moderation/utils/validation.js";

describe("moderation input validation", () => {
  it("trims and accepts meaningful reasons", () => expect(validateReason("  repeated spam  ")).toBe("repeated spam"));
  it("rejects blank or oversized reasons", () => {
    expect(() => validateReason("  ")).toThrow();
    expect(() => validateReason("x".repeat(1_001))).toThrow();
  });
  it("extracts safe Discord snowflakes", () => expect(parseSnowflake("<@123456789012345678>")).toBe("123456789012345678"));
});

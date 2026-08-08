import { describe, expect, it } from "vitest";

import { normalizeTypeName, parseHexColor, validateEmoji } from "../src/modules/moderation/utils/custom-type.js";

describe("custom case types", () => {
  it("normalizes case-insensitive names and validates colors", () => {
    expect(normalizeTypeName("  Appeal Accepted ")).toBe("appeal accepted");
    expect(parseHexColor("#A1b2C3")).toBe(0xa1b2c3);
    expect(() => parseHexColor("red")).toThrow("#RRGGBB");
  });
  it("accepts Unicode and Discord custom emoji while rejecting plain text", () => {
    expect(validateEmoji("🏷️")).toBe("🏷️");
    expect(validateEmoji("<:case_type:12345678901234567>")).toContain("case_type");
    expect(() => validateEmoji("badge")).toThrow("valid Unicode emoji");
  });
});

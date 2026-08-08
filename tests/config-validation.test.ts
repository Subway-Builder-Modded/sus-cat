import { describe, expect, it } from "vitest";

import { validateConfigValue } from "../src/core/config/validation.js";
import type { ConfigDefinition } from "../src/core/config/definitions.js";

const field = (type: ConfigDefinition["type"], extra: Partial<ConfigDefinition> = {}): ConfigDefinition => ({ key: "value", label: "Value", description: "", type, defaultValue: null, category: "test", ...extra });

describe("configuration validation", () => {
  it("validates booleans, bounded integers, channels, roles, URLs, and lists", () => {
    expect(validateConfigValue(field("boolean"), true)).toBe(true);
    expect(validateConfigValue(field("integer", { min: 1, max: 5 }), 3)).toBe(3);
    expect(validateConfigValue(field("channel"), "12345678901234567")).toBe("12345678901234567");
    expect(validateConfigValue(field("role-list"), ["12345678901234567", "12345678901234567"])).toEqual(["12345678901234567"]);
    expect(validateConfigValue(field("url"), "https://example.com/rules")).toBe("https://example.com/rules");
  });

  it("fails closed for malformed persisted values", () => {
    expect(() => validateConfigValue(field("boolean"), "true")).toThrow("invalid boolean");
    expect(() => validateConfigValue(field("integer", { max: 5 }), 6)).toThrow("at most 5");
    expect(() => validateConfigValue(field("channel"), "not-a-channel")).toThrow("invalid channel");
    expect(() => validateConfigValue(field("url"), "javascript:alert(1)")).toThrow("invalid url");
  });
});

import { describe, expect, it } from "vitest";

import { canTransitionCase } from "../src/modules/moderation/domain/case-state.js";

describe("case state transitions", () => {
  it("allows normal application and reversal", () => {
    expect(canTransitionCase("pending", "active")).toBe(true);
    expect(canTransitionCase("active", "reversed")).toBe(true);
  });

  it("keeps voided cases immutable", () => {
    expect(canTransitionCase("voided", "active")).toBe(false);
    expect(canTransitionCase("expired", "active")).toBe(false);
  });
});

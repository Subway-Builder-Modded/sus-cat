import { describe, expect, it } from "vitest";

import { isScheduledCaseActionable } from "../src/moderation/domain/scheduled-action.js";

describe("temporary action expiration", () => {
  it("only executes jobs for currently active cases", () => {
    expect(isScheduledCaseActionable("active")).toBe(true);
    expect(isScheduledCaseActionable("reversed")).toBe(false);
    expect(isScheduledCaseActionable("voided")).toBe(false);
    expect(isScheduledCaseActionable(undefined)).toBe(false);
  });
});

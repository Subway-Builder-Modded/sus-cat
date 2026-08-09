import { describe, expect, it } from "vitest";

import { filterCaseActions } from "../src/modules/moderation/interactions/user-view-controller.js";

describe("user management filters", () => {
  it("maps every user view to the shared case-entry action filter", () => {
    expect(filterCaseActions("warns")).toEqual(["warn"]);
    expect(filterCaseActions("timeouts")).toEqual(["timeout", "untimeout"]);
    expect(filterCaseActions("kicks")).toEqual(["kick"]);
    expect(filterCaseActions("bans")).toEqual(["ban", "unban"]);
    expect(filterCaseActions("case")).toBeUndefined();
  });
});

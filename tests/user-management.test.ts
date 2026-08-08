import { describe, expect, it } from "vitest";

import { filterActions } from "../src/modules/moderation/commands/user.js";

describe("user management filters", () => {
  it("maps every user view to the shared case-entry action filter", () => {
    expect(filterActions("warns")).toEqual(["warn"]);
    expect(filterActions("timeouts")).toEqual(["timeout", "untimeout"]);
    expect(filterActions("kicks")).toEqual(["kick"]);
    expect(filterActions("bans")).toEqual(["ban", "unban"]);
    expect(filterActions("case")).toBeUndefined();
  });
});

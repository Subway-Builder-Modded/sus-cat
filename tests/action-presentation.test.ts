import { describe, expect, it } from "vitest";

import { actionPresentation } from "../src/modules/moderation/ui/actions/presentation.js";

describe("central moderation visuals", () => {
  it("gives core actions distinct emoji and expected color identities", () => {
    const actions = ["ban", "kick", "timeout", "warn", "unban", "untimeout", "nickname", "slowmode"] as const;
    expect(new Set(actions.map((action) => actionPresentation[action].emoji)).size).toBe(actions.length);
    expect(actionPresentation.ban.color).toBe(0xed4245);
    expect(actionPresentation.kick.color).toBe(0xf39c12);
    expect(actionPresentation.warn.color).toBe(0x3498db);
  });
});

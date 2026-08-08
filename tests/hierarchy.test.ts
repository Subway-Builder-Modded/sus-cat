import { describe, expect, it } from "vitest";

import { validateTargetHierarchy } from "../src/modules/moderation/permissions/hierarchy.js";

function member(id: string, position: number, ownerId = "owner") {
  return { id, guild: { ownerId }, roles: { highest: { comparePositionTo: (other: { position: number }) => position - other.position, position } } };
}

describe("moderator hierarchy", () => {
  it("rejects self moderation and the server owner", () => {
    const actor = member("actor", 10);
    expect(() => validateTargetHierarchy(actor as never, actor as never, member("bot", 20) as never)).toThrow("yourself");
    expect(() => validateTargetHierarchy(actor as never, member("owner", 1) as never, member("bot", 20) as never)).toThrow("server owner");
  });

  it("requires both actor and bot to outrank the target", () => {
    expect(() => validateTargetHierarchy(member("actor", 5) as never, member("target", 10) as never, member("bot", 20) as never)).toThrow("Your highest role");
    expect(() => validateTargetHierarchy(member("actor", 20) as never, member("target", 10) as never, member("bot", 5) as never)).toThrow("My highest role");
  });
});

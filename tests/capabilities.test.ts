import { PermissionFlagsBits } from "discord.js";
import { describe, expect, it } from "vitest";

import type { ModerationConfig } from "../src/database/schema.js";
import { hasCapability } from "../src/moderation/permissions/capabilities.js";

const config = { staffRoleIds: ["staff"] } as ModerationConfig;

function member(options: { permissions?: bigint[]; roles?: string[]; owner?: boolean }) {
  const permissions = options.permissions ?? [];
  const roles = options.roles ?? [];
  return {
    id: options.owner ? "owner" : "member",
    guild: { ownerId: "owner" },
    permissions: { has: (permission: bigint) => permissions.includes(permission) },
    roles: { cache: { some: (predicate: (role: { id: string }) => boolean) => roles.some((id) => predicate({ id })) } },
  };
}

describe("moderation capabilities", () => {
  it("recognizes native Discord permissions", () => {
    expect(hasCapability(member({ permissions: [PermissionFlagsBits.BanMembers] }) as never, "moderation.ban", config)).toBe(true);
  });

  it("limits configured staff roles to non-destructive capabilities", () => {
    const staff = member({ roles: ["staff"] });
    expect(hasCapability(staff as never, "moderation.warn", config)).toBe(true);
    expect(hasCapability(staff as never, "moderation.ban", config)).toBe(false);
  });
});

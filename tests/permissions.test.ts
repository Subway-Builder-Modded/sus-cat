import { PermissionFlagsBits } from "discord.js";
import { describe, expect, it } from "vitest";

import { hasModerationAccess } from "../src/modules/moderation/permissions/authorization.js";

function fixture(options: { permissions?: bigint[]; roles?: string[]; owner?: boolean; botAdmins?: string[]; moderators?: string[] }) {
  const permissions = options.permissions ?? [], roles = options.roles ?? [];
  const member = { id: options.owner ? "owner" : "member", guild: { id: "guild", ownerId: "owner" }, permissions: { has: (permission: bigint) => permissions.includes(permission) }, roles: { cache: { some: (predicate: (role: { id: string }) => boolean) => roles.some((id) => predicate({ id })) } } };
  const moderationService = { configs: { get: async () => ({ moderatorRoleIds: options.moderators ?? [] }) } };
  const client = {
    platform: { settings: { hasCompletedSetup: async () => true, botAdminRoleIds: async () => options.botAdmins ?? [] } },
    requireModuleService: () => moderationService,
  };
  return { client: client as never, member: member as never };
}

describe("central moderation authorization", () => {
  it("accepts native command permissions", async () => {
    const { client, member } = fixture({ permissions: [PermissionFlagsBits.BanMembers] });
    await expect(hasModerationAccess(client, member, PermissionFlagsBits.BanMembers)).resolves.toBe(true);
  });
  it("allows Moderator and Bot Admin role bypasses for ordinary actions", async () => {
    const moderator = fixture({ roles: ["moderator"], moderators: ["moderator"] });
    const admin = fixture({ roles: ["bot-admin"], botAdmins: ["bot-admin"] });
    await expect(hasModerationAccess(moderator.client, moderator.member, PermissionFlagsBits.KickMembers)).resolves.toBe(true);
    await expect(hasModerationAccess(admin.client, admin.member, PermissionFlagsBits.ModerateMembers)).resolves.toBe(true);
  });
  it("rejects unrelated users and excludes Moderator roles from destructive reset access", async () => {
    const unrelated = fixture({ roles: ["other"], moderators: ["moderator"] });
    const moderator = fixture({ roles: ["moderator"], moderators: ["moderator"] });
    await expect(hasModerationAccess(unrelated.client, unrelated.member, PermissionFlagsBits.BanMembers)).resolves.toBe(false);
    await expect(hasModerationAccess(moderator.client, moderator.member, PermissionFlagsBits.ManageGuild, true)).resolves.toBe(false);
  });
});

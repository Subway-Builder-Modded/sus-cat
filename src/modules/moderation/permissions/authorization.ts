import { PermissionFlagsBits, type GuildMember } from "discord.js";

import type { BotClient } from "../../../core/bot/bot-client.js";
import { isBotAdmin } from "../../../core/permissions/configuration.js";

export async function hasModerationAccess(client: BotClient, member: GuildMember, nativePermission: bigint, destructive = false): Promise<boolean> {
  if (member.id === member.guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(nativePermission)) return true;
  if (await isBotAdmin(client.platform.settings, member)) return true;
  if (destructive) return false;
  const config = await client.moderation!.configs.get(member.guild.id);
  return member.roles.cache.some((role) => config.moderatorRoleIds.includes(role.id));
}

export async function requireModerationAccess(client: BotClient, member: GuildMember, nativePermission: bigint, destructive = false): Promise<void> {
  if (!await hasModerationAccess(client, member, nativePermission, destructive)) throw new Error("You do not have permission to use this moderation control.");
}

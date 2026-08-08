import { PermissionFlagsBits, type GuildMember } from "discord.js";
import type { GuildConfigService } from "../config/service.js";

export function canConfigure(member: GuildMember): boolean {
  return member.id === member.guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export async function isBotAdmin(settings: GuildConfigService, member: GuildMember): Promise<boolean> {
  if (!await settings.hasCompletedSetup(member.guild.id)) return false;
  const roles = await settings.botAdminRoleIds(member.guild.id);
  return member.roles.cache.some((role) => roles.includes(role.id));
}

export async function canConfigureBot(settings: GuildConfigService, member: GuildMember): Promise<boolean> {
  return canConfigure(member) || await isBotAdmin(settings, member);
}

export async function requireConfigurationAccess(settings: GuildConfigService, member: GuildMember): Promise<void> {
  if (!await canConfigureBot(settings, member)) throw new Error("You need Manage Server or a configured Bot Admin role to configure this bot.");
}

import { PermissionFlagsBits, type GuildMember } from "discord.js";

export function canConfigure(member: GuildMember): boolean {
  return member.id === member.guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator) || member.permissions.has(PermissionFlagsBits.ManageGuild);
}

export function requireConfigurationAccess(member: GuildMember): void {
  if (!canConfigure(member)) throw new Error("You need Manage Server to configure this bot.");
}

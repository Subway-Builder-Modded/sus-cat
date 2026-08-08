import { PermissionFlagsBits, type GuildMember } from "discord.js";

import type { ModerationConfig } from "../../database/schema.js";

export type Capability =
  | "moderation.view" | "moderation.warn" | "moderation.note" | "moderation.timeout"
  | "moderation.kick" | "moderation.ban" | "moderation.unban" | "moderation.purge"
  | "moderation.channel.manage" | "moderation.nick" | "moderation.case.edit" | "moderation.case.void"
  | "moderation.evidence.manage" | "moderation.config" | "moderation.audit.view";

const permissionByCapability: Record<Capability, bigint> = {
  "moderation.view": PermissionFlagsBits.ManageMessages,
  "moderation.warn": PermissionFlagsBits.ManageMessages,
  "moderation.note": PermissionFlagsBits.ManageMessages,
  "moderation.timeout": PermissionFlagsBits.ModerateMembers,
  "moderation.kick": PermissionFlagsBits.KickMembers,
  "moderation.ban": PermissionFlagsBits.BanMembers,
  "moderation.unban": PermissionFlagsBits.BanMembers,
  "moderation.purge": PermissionFlagsBits.ManageMessages,
  "moderation.channel.manage": PermissionFlagsBits.ManageChannels,
  "moderation.nick": PermissionFlagsBits.ManageNicknames,
  "moderation.case.edit": PermissionFlagsBits.ManageMessages,
  "moderation.case.void": PermissionFlagsBits.ManageGuild,
  "moderation.evidence.manage": PermissionFlagsBits.ManageMessages,
  "moderation.config": PermissionFlagsBits.ManageGuild,
  "moderation.audit.view": PermissionFlagsBits.ViewAuditLog,
};

export function hasCapability(member: GuildMember, capability: Capability, config: ModerationConfig): boolean {
  if (member.id === member.guild.ownerId || member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (member.permissions.has(permissionByCapability[capability])) return true;
  const roleGranted = member.roles.cache.some((role) => config.staffRoleIds.includes(role.id));
  return roleGranted && ["moderation.view", "moderation.warn", "moderation.note", "moderation.case.edit", "moderation.evidence.manage"].includes(capability);
}

export function requireCapability(member: GuildMember, capability: Capability, config: ModerationConfig): void {
  if (!hasCapability(member, capability, config)) throw new Error(`You do not have the required capability: \`${capability}\`.`);
}

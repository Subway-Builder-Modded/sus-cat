import { PermissionFlagsBits } from "discord.js";

import type { ModuleManifest } from "../../core/modules/types.js";

export const moderationManifest = {
  id: "moderation",
  name: "Moderation",
  description: "Structured staff actions, cases, evidence, channel controls, and audit history.",
  version: "1.0.0",
  icon: "🛡️",
  defaultEnabled: false,
  features: [
    { id: "warnings", name: "Warnings", description: "Issue formal warnings.", defaultEnabled: true, requiredBotPermissions: [PermissionFlagsBits.ManageMessages] },
    { id: "notes", name: "Staff Notes", description: "Store private staff notes.", defaultEnabled: true },
    { id: "timeouts", name: "Timeouts", description: "Apply and remove timeouts.", defaultEnabled: true, requiredBotPermissions: [PermissionFlagsBits.ModerateMembers] },
    { id: "kicks", name: "Kicks", description: "Remove members from the guild.", defaultEnabled: true, requiredBotPermissions: [PermissionFlagsBits.KickMembers] },
    { id: "bans", name: "Bans", description: "Ban and unban users.", defaultEnabled: true, requiredBotPermissions: [PermissionFlagsBits.BanMembers] },
    { id: "temporary-bans", name: "Temporary Bans", description: "Schedule automatic unbans.", defaultEnabled: true, dependencies: ["bans"] },
    { id: "softbans", name: "Softbans", description: "Ban and immediately unban to remove messages.", defaultEnabled: true, dependencies: ["bans"] },
    { id: "purge", name: "Purge", description: "Bulk-delete matching messages.", defaultEnabled: true, requiredBotPermissions: [PermissionFlagsBits.ManageMessages] },
    { id: "nickname", name: "Nickname Moderation", description: "Change or reset member nicknames.", defaultEnabled: true, requiredBotPermissions: [PermissionFlagsBits.ManageNicknames] },
    { id: "channel-locks", name: "Channel Locks", description: "Lock channels while preserving prior overwrites.", defaultEnabled: true, requiredBotPermissions: [PermissionFlagsBits.ManageChannels] },
    { id: "slowmode", name: "Slowmode", description: "Configure channel rate limits.", defaultEnabled: true, requiredBotPermissions: [PermissionFlagsBits.ManageChannels] },
    { id: "case-management", name: "Case Management", description: "Search, edit, and review cases.", defaultEnabled: true },
    { id: "evidence", name: "Evidence", description: "Attach evidence to moderation cases.", defaultEnabled: true, dependencies: ["case-management"] },
    { id: "user-dms", name: "User DMs", description: "Notify users about moderation actions.", defaultEnabled: true },
    { id: "logs", name: "Moderation Logs", description: "Publish action summaries to a staff channel.", defaultEnabled: true },
    { id: "audit", name: "Audit Logs", description: "Publish private moderation records.", defaultEnabled: true },
    { id: "case-buttons", name: "Case Buttons", description: "Attach persistent controls to case logs.", defaultEnabled: true, dependencies: ["case-management"] },
  ],
  config: [
    { key: "modLogChannelId", label: "Moderation log channel", description: "Channel for moderation case summaries.", type: "channel", defaultValue: null, category: "channels", setup: true, requiredWhen: { featureId: "logs", enabled: true } },
    { key: "auditLogChannelId", label: "Audit log channel", description: "Private channel for staff audit events.", type: "channel", defaultValue: null, category: "channels", setup: true, requiredWhen: { featureId: "audit", enabled: true } },
    { key: "dmUsers", label: "DM moderated users", description: "Attempt to notify users about actions.", type: "boolean", defaultValue: true, category: "behavior", setup: true },
    { key: "rulesUrl", label: "Rules URL", description: "Optional link included in user notices.", type: "url", defaultValue: null, category: "behavior" },
    { key: "purgeConfirmationThreshold", label: "Purge confirmation threshold", description: "Number of messages that requires confirmation.", type: "integer", defaultValue: 25, min: 1, max: 100, category: "behavior" },
    { key: "staffRoleIds", label: "Staff roles", description: "Roles granted basic moderation capabilities.", type: "role-list", defaultValue: [], category: "permissions", setup: true },
    { key: "reasonPresets", label: "Reason presets", description: "Reusable moderation reasons.", type: "string-list", defaultValue: ["Spam", "Harassment", "Advertising", "Inappropriate content", "Rule evasion", "Staff discretion"], category: "behavior" },
  ],
  capabilities: [
    "view", "warn", "note", "timeout", "kick", "ban", "unban", "purge", "channel.manage", "nick", "case.edit", "case.void", "evidence.manage", "config", "audit.view",
  ].map((id) => ({ id: `moderation.${id}`, description: `Moderation capability: ${id}` })),
  docs: [
    { id: "overview", title: "Moderation Overview", category: "Modules", summary: "How the moderation module works.", body: "Moderation records durable cases for staff actions. Feature switches and permissions are enforced before commands or controls run.", keywords: ["moderation", "staff", "cases"] },
    { id: "cases", title: "Cases and Evidence", category: "Moderation", summary: "Search, review, and amend case records.", body: "Each action receives a guild-scoped case number. Evidence and revisions remain attached to the case and survive deployments.", keywords: ["case", "evidence", "history"] },
    { id: "permissions", title: "Moderation Permissions", category: "Permissions", summary: "Discord permissions and staff roles.", body: "Native Discord permissions are respected. Configured staff roles can grant basic case, warning, note, and evidence access.", keywords: ["roles", "permissions", "capabilities"] },
  ],
} as const satisfies ModuleManifest;

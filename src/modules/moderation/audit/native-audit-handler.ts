import { AuditLogEvent, EmbedBuilder, Events, type GuildAuditLogsEntry } from "discord.js";

import type { ModuleEventHandler } from "../../../core/modules/types.js";
import { logger } from "../../../core/shared/logger.js";
import { toError } from "../../../core/shared/to-error.js";

const moderationEvents = new Set<AuditLogEvent>([
  AuditLogEvent.MemberBanAdd, AuditLogEvent.MemberBanRemove, AuditLogEvent.MemberKick, AuditLogEvent.MemberUpdate,
  AuditLogEvent.MemberRoleUpdate, AuditLogEvent.MessageDelete, AuditLogEvent.MessageBulkDelete,
]);

export default {
  name: Events.GuildAuditLogEntryCreate,
  async execute(client, entry, guild) {
    try {
      if (await client.platform.settings.setupStatus(guild.id) !== "configured" || !await client.platform.settings.isFeatureEnabled(guild.id, "moderation", "audit-log")) return;
      if (entry.executorId === client.user?.id) return; // Bot-originated actions are published directly with richer context.
      const config = await client.moderation!.configs.get(guild.id);
      if (!shouldIncludeAuditEvent(config.auditScope, entry.action)) return;
      const changes = Object.fromEntries((entry.changes ?? []).map((change) => [change.key, { old: change.old ?? null, new: change.new ?? null }]));
      const targetUserId = typeof entry.targetId === "string" ? entry.targetId : undefined;
      const created = await client.moderation!.cases.recordNativeAudit({ guildId: guild.id, actorId: entry.executorId ?? client.user?.id ?? "system", ...(targetUserId ? { targetUserId } : {}), sourceEventId: entry.id, eventType: `discord.${AuditLogEvent[entry.action] ?? entry.action}`, metadata: { action: entry.action, reason: entry.reason, extra: printableExtra(entry) }, after: changes });
      if (!created || !config.auditLogChannelId) return;
      const channel = await guild.channels.fetch(config.auditLogChannelId).catch(() => undefined); if (!channel?.isSendable()) return;
      const actionName = (AuditLogEvent[entry.action] ?? `Event ${entry.action}`).replace(/([a-z])([A-Z])/g, "$1 $2");
      const embed = new EmbedBuilder().setColor(0x607d8b).setTitle(`🔎 ${actionName}`).addFields(
        { name: "Actor", value: entry.executorId ? `<@${entry.executorId}> \`${entry.executorId}\`` : "Unknown", inline: true },
        { name: "Target", value: entry.targetId ? `\`${entry.targetId}\`` : "N/A", inline: true },
        { name: "Source", value: "Discord Audit Log", inline: true },
      ).setTimestamp(entry.createdAt);
      if (entry.reason) embed.addFields({ name: "Reason", value: entry.reason });
      if (Object.keys(changes).length) embed.addFields({ name: "Changes", value: renderChanges(changes) });
      await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    } catch (error: unknown) { logger.warn("Native audit event could not be processed", { guildId: guild.id, entryId: entry.id, error: toError(error).message }); }
  },
} satisfies ModuleEventHandler<typeof Events.GuildAuditLogEntryCreate>;

export function shouldIncludeAuditEvent(scope: "moderation" | "full", action: AuditLogEvent): boolean { return scope === "full" || moderationEvents.has(action); }

function printableExtra(entry: GuildAuditLogsEntry): string | number | null { const value = entry.extra; return typeof value === "string" || typeof value === "number" ? value : null; }
function renderChanges(changes: Record<string, { old: unknown; new: unknown }>): string { return Object.entries(changes).slice(0, 10).map(([key, value]) => `**${key}**: ${brief(value.old)} → ${brief(value.new)}`).join("\n").slice(0, 1024); }
function brief(value: unknown): string { if (value == null) return "None"; if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).slice(0, 120); return "Updated"; }

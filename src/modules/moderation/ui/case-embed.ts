import { EmbedBuilder, type User } from "discord.js";

import type { ModerationCase } from "../database/schema.js";
import { formatDuration } from "../utils/duration.js";
import { truncate } from "../utils/validation.js";
import { moderationColors, moderationIcons } from "./theme.js";

const inactiveStatuses = new Set(["expired", "reversed", "voided", "superseded", "failed"]);

export function buildCaseEmbed(item: ModerationCase, target?: User, evidenceCount = 0): EmbedBuilder {
  const color = item.action === "note" ? moderationColors.private
    : inactiveStatuses.has(item.status) ? moderationColors.inactive
      : ["ban", "kick", "softban"].includes(item.action) ? moderationColors.destructive
        : item.action === "timeout" ? moderationColors.timeout : moderationColors.warning;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${moderationIcons.case} Case #${item.caseNumber} • ${label(item.action)}`)
    .setDescription(truncate(item.reason, 4_000))
    .addFields(
      { name: "Member", value: target ? `${target} \`${target.id}\`` : `<@${item.targetUserId}> \`${item.targetUserId}\``, inline: true },
      { name: "Moderator", value: `<@${item.actorId}> \`${item.actorId}\``, inline: true },
      { name: "Status", value: `**${label(item.status)}**`, inline: true },
      { name: "Created", value: `<t:${Math.floor(item.createdAt.getTime() / 1_000)}:F>`, inline: true },
      { name: "Evidence", value: String(evidenceCount), inline: true },
      { name: "Automated", value: item.automated ? "Yes" : "No", inline: true },
    )
    .setFooter({ text: `Case ID: ${item.id}` })
    .setTimestamp(item.updatedAt);

  if (target) embed.setThumbnail(target.displayAvatarURL());
  if (item.durationMs) embed.addFields({ name: "Duration", value: formatDuration(item.durationMs), inline: true });
  if (item.expiresAt) embed.addFields({ name: "Expires", value: `<t:${Math.floor(item.expiresAt.getTime() / 1_000)}:R>`, inline: true });
  if (item.internalNote) embed.addFields({ name: `${moderationIcons.note} Internal note`, value: truncate(item.internalNote, 1_024) });
  if (item.sourceUrl) embed.addFields({ name: "Source", value: `[Jump to message](${item.sourceUrl})` });
  return embed;
}

export function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

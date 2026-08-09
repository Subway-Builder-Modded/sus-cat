import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, type User } from "discord.js";

import type { ModerationCaseEntry, ModerationEvidence, ModerationUserCase } from "../../database/schema.js";
import type { HistorySummary } from "../../domain/types.js";
import { componentId } from "../../utils/custom-id.js";
import { actionPresentation } from "../actions/presentation.js";
import { formatDuration } from "../../utils/duration.js";

export function caseOverview(input: { case: ModerationUserCase; user?: User; summary: HistorySummary; latest?: ModerationCaseEntry; actorId: string; isEvidenceEnabled: boolean; previousNumber?: number; nextNumber?: number }) {
  const name = input.user?.username ?? `User ${input.case.targetUserId}`;
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`🛡️ Case #${input.case.caseNumber} • ${name}`).setDescription(`**User**\n${input.user ?? `<@${input.case.targetUserId}>`}\nID: \`${input.case.targetUserId}\``).addFields(
    { name: "Summary", value: `Warnings: **${input.summary.warnings}**\nTimeouts: **${input.summary.timeouts}**\nKicks: **${input.summary.kicks}**\nBans: **${input.summary.bans}**`, inline: true },
    { name: "Evidence", value: `**${input.summary.evidence}** piece${input.summary.evidence === 1 ? "" : "s"}`, inline: true },
  ).setTimestamp(input.case.updatedAt);
  if (input.user) embed.setThumbnail(input.user.displayAvatarURL());
  if (input.latest) {
    const visual = actionPresentation[input.latest.action];
    embed.addFields({ name: "Latest Activity", value: `${visual.emoji} **${visual.label}**\nModerator: <@${input.latest.actorId}>\n${input.latest.reason ? `Reason: ${input.latest.reason}\n` : ""}<t:${Math.floor(input.latest.createdAt.getTime() / 1000)}:F>` });
  }
  const first = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("case_timeline", input.actorId, input.case.id, "1")).setLabel("Timeline").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(componentId("user_view", input.actorId, input.case.targetUserId)).setLabel("User").setStyle(ButtonStyle.Secondary),
  );
  if (input.isEvidenceEnabled) first.addComponents(new ButtonBuilder().setCustomId(componentId("case_evidence", input.actorId, input.case.id, "1")).setLabel("Evidence").setStyle(ButtonStyle.Secondary));
  const second = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("case_number", input.actorId, String(input.previousNumber ?? input.case.caseNumber))).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(!input.previousNumber),
    new ButtonBuilder().setCustomId(componentId("case_number", input.actorId, String(input.nextNumber ?? input.case.caseNumber))).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(!input.nextNumber),
    new ButtonBuilder().setCustomId(componentId("case_back", input.actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [embed], components: [first, second], allowedMentions: { parse: [] } };
}

export function timelineView(input: { case: ModerationUserCase; entries: ModerationCaseEntry[]; page: number; pages: number; actorId: string }) {
  const description = input.entries.map((entry) => {
    const visual = actionPresentation[entry.action];
    const type = entry.customTypeName ? `${entry.customTypeEmoji ?? "🏷️"} **${entry.customTypeName}** • ` : "";
    return `${visual.emoji} ${type}**${visual.label}**\nModerator: <@${entry.actorId}> • <t:${Math.floor(entry.createdAt.getTime() / 1000)}:F>${entry.durationMs ? `\nDuration: ${formatDuration(entry.durationMs)}` : ""}${entry.reason ? `\nReason: ${entry.reason}` : ""}`;
  }).join("\n\n") || "No case entries yet.";
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`Case #${input.case.caseNumber} --> Timeline`).setDescription(description).setFooter({ text: `Page ${input.page} of ${input.pages}` });
  return { embeds: [embed], components: [pagination("case_timeline", input.actorId, input.case.id, input.page, input.pages), backRow("case_number", input.actorId, String(input.case.caseNumber))], allowedMentions: { parse: [] } };
}

export function evidenceView(input: { case: ModerationUserCase; items: ModerationEvidence[]; index: number; actorId: string }) {
  const item = input.items[input.index];
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`Case #${input.case.caseNumber} --> Evidence`).setDescription(item ? `**Evidence**\n${item.evidence}\n\n**Description**\n${item.description ?? "None"}\n\n**Result**\n${item.result === "none" ? "None" : actionPresentation[item.result].label}\n\n**Added by**\n<@${item.addedById}> • <t:${Math.floor(item.createdAt.getTime() / 1000)}:F>` : "No evidence has been added to this case.");
  if (item) embed.setFooter({ text: `Evidence ${input.index + 1} of ${input.items.length}` });
  const controls = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("case_evidence_page", input.actorId, input.case.id, String(Math.max(0, input.index - 1)))).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(!item || input.index === 0),
    new ButtonBuilder().setCustomId(componentId("case_evidence_page", input.actorId, input.case.id, String(Math.min(input.items.length - 1, input.index + 1)))).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(!item || input.index >= input.items.length - 1),
    new ButtonBuilder().setCustomId(componentId("case_evidence_add", input.actorId, input.case.id)).setLabel("Add").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(componentId("case_evidence_edit", input.actorId, input.case.id, item?.id ?? "none")).setLabel("Edit").setStyle(ButtonStyle.Secondary).setDisabled(!item),
    new ButtonBuilder().setCustomId(componentId("case_evidence_delete", input.actorId, input.case.id, item?.id ?? "none")).setLabel("Delete").setStyle(ButtonStyle.Danger).setDisabled(!item),
  );
  return { embeds: [embed], components: [controls, backRow("case_number", input.actorId, String(input.case.caseNumber))], allowedMentions: { parse: [] } };
}

export function evidenceResultMenu(actorId: string, caseId: string, evidenceId: string) {
  const options = ["none", "warn", "timeout", "kick", "ban", "unban", "untimeout"] as const;
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(componentId("case_evidence_result", actorId, caseId, evidenceId)).setPlaceholder("Choose the moderation result").addOptions(options.map((value) => ({ label: value === "none" ? "None" : actionPresentation[value].label, value }))));
}

function pagination(action: string, actorId: string, id: string, page: number, pages: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId(action, actorId, id, String(page - 1))).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(componentId(action, actorId, id, String(page + 1))).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(page >= pages),
  );
}
function backRow(action: string, actorId: string, id: string) { return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId(action, actorId, id)).setLabel("Back").setStyle(ButtonStyle.Secondary)); }

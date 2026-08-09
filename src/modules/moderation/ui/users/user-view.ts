import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type GuildMember, type User } from "discord.js";

import type { ModerationCaseEntry, ModerationUserCase } from "../../database/schema.js";
import type { HistorySummary } from "../../domain/types.js";
import { componentId } from "../../utils/custom-id.js";
import { actionPresentation } from "../actions/presentation.js";

export function userDashboard(input: { user: User; member?: GuildMember; case?: ModerationUserCase; summary: HistorySummary; recent: ModerationCaseEntry[]; actorId: string }) {
  const roles = input.member
    ? input.member.roles.cache
      .filter((role) => role.id !== input.member?.guild.roles.everyone.id)
      .sort((left, right) => right.position - left.position)
      .first(10)
      .join(", ") || "None"
    : "Not currently in server";
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`👤 ${input.member?.displayName ?? input.user.username}`).setThumbnail(input.user.displayAvatarURL()).addFields(
    { name: "Account", value: `Created: <t:${Math.floor(input.user.createdTimestamp / 1000)}:F>\nJoined: ${input.member?.joinedTimestamp ? `<t:${Math.floor(input.member.joinedTimestamp / 1000)}:F>` : "Not currently in server"}\nID: \`${input.user.id}\`` },
    { name: "Current", value: `Nickname: ${input.member?.nickname ?? "None"}\nTimeout: ${input.member?.communicationDisabledUntilTimestamp ? `<t:${Math.floor(input.member.communicationDisabledUntilTimestamp / 1000)}:R>` : "No"}\nRoles: ${roles}` },
    { name: "Moderation", value: `Case: ${input.case ? `#${input.case.caseNumber}` : "None"}\nWarnings: **${input.summary.warnings}** • Timeouts: **${input.summary.timeouts}**\nKicks: **${input.summary.kicks}** • Bans: **${input.summary.bans}**\nEvidence: **${input.summary.evidence}**` },
    { name: "Recent Activity", value: input.recent.map((entry) => `${actionPresentation[entry.action].emoji} **${actionPresentation[entry.action].label}** • <t:${Math.floor(entry.createdAt.getTime() / 1000)}:R>`).join("\n") || "No moderation activity." },
  );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("user_filter", input.actorId, input.user.id, "all", "1")).setLabel("Case").setStyle(ButtonStyle.Primary).setDisabled(!input.case),
    new ButtonBuilder().setCustomId(componentId("user_filter", input.actorId, input.user.id, "warn", "1")).setLabel("Warnings").setStyle(ButtonStyle.Secondary).setDisabled(!input.case),
    new ButtonBuilder().setCustomId(componentId("user_filter", input.actorId, input.user.id, "timeout", "1")).setLabel("Timeouts").setStyle(ButtonStyle.Secondary).setDisabled(!input.case),
    new ButtonBuilder().setCustomId(componentId("user_filter", input.actorId, input.user.id, "kick", "1")).setLabel("Kicks").setStyle(ButtonStyle.Secondary).setDisabled(!input.case),
    new ButtonBuilder().setCustomId(componentId("user_filter", input.actorId, input.user.id, "ban", "1")).setLabel("Bans").setStyle(ButtonStyle.Secondary).setDisabled(!input.case),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] } };
}

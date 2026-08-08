import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, type GuildMember, type User } from "discord.js";

import type { CaseHistoryPage, HistorySummary } from "../domain/types.js";
import { componentId } from "../utils/custom-id.js";
import { truncate } from "../utils/validation.js";
import { moderationColors } from "./theme.js";

export function buildHistoryDashboard(user: User, member: GuildMember | undefined, summary: HistorySummary, history: CaseHistoryPage, viewerId: string) {
  const recent = history.cases.map((item) => `**#${item.caseNumber}** ${item.action.toUpperCase()} — ${truncate(item.reason, 80)} • <t:${Math.floor(item.createdAt.getTime() / 1_000)}:R>`).join("\n") || "No moderation history.";
  const embed = new EmbedBuilder()
    .setColor(moderationColors.info)
    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL() })
    .setTitle("Member Moderation Overview")
    .addFields(
      { name: "Member", value: `${user} \`${user.id}\`` },
      { name: "Account created", value: `<t:${Math.floor(user.createdTimestamp / 1_000)}:R>`, inline: true },
      { name: "Joined server", value: member?.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1_000)}:R>` : "Not in server", inline: true },
      { name: "Current status", value: `${member?.isCommunicationDisabled() ? "Timed out" : "No Discord timeout"} • ${summary.active} active case${summary.active === 1 ? "" : "s"}` },
      { name: "History", value: `${summary.warnings} warnings • ${summary.timeouts} timeouts • ${summary.kicks} kicks • ${summary.bans} bans • ${summary.notes} notes` },
      { name: `Cases • Page ${history.page}/${history.pages}`, value: recent },
    )
    .setFooter({ text: `${summary.total} total cases` })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("history", viewerId, user.id, String(history.page - 1))).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(history.page <= 1),
    new ButtonBuilder().setCustomId(componentId("history", viewerId, user.id, String(history.page + 1))).setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(history.page >= history.pages),
    new ButtonBuilder().setCustomId(componentId("quick", viewerId, user.id)).setLabel("Moderate").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(componentId("history", viewerId, user.id, String(history.page))).setLabel("Refresh").setStyle(ButtonStyle.Success),
  );
  const components: Array<ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>> = [row];
  if (history.cases.length > 0) {
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId(componentId("history_case", viewerId)).setPlaceholder("View a case from this page").addOptions(history.cases.map((item) => ({ label: `Case #${item.caseNumber} • ${item.action}`, description: truncate(item.reason, 90), value: item.id }))),
    ));
  }
  return { embeds: [embed], components, allowedMentions: { parse: [] as never[] } };
}

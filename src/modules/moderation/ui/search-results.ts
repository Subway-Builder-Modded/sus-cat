import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

import type { ModerationCase } from "../database/schema.js";
import { componentId } from "../utils/custom-id.js";
import { normalizePage } from "../utils/pagination.js";
import { truncate } from "../utils/validation.js";
import { moderationColors } from "./theme.js";

export function buildSearchResults(results: ModerationCase[], actorId: string, token: string, requestedPage = 1) {
  const pagination = normalizePage(requestedPage, results.length, 5);
  const items = results.slice(pagination.offset, pagination.offset + 5);
  const embed = new EmbedBuilder().setColor(moderationColors.info).setTitle("Case Search")
    .setDescription(items.map((item) => `**#${item.caseNumber}** ${item.action.toUpperCase()} • <@${item.targetUserId}>\n${item.status} • ${truncate(item.reason, 120)} • <t:${Math.floor(item.createdAt.getTime() / 1_000)}:R>`).join("\n\n") || "No matching cases.")
    .setFooter({ text: `${results.length} results • Page ${pagination.page}/${pagination.pages}` });
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("search", actorId, token, String(pagination.page - 1))).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(pagination.page <= 1),
    new ButtonBuilder().setCustomId(componentId("search", actorId, token, String(pagination.page + 1))).setLabel("Next").setStyle(ButtonStyle.Primary).setDisabled(pagination.page >= pagination.pages),
  );
  return { embeds: [embed], components: [row], allowedMentions: { parse: [] as never[] } };
}

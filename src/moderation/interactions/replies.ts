import type { CommandInteraction, InteractionReplyOptions } from "discord.js";

import { buildCaseEmbed } from "../ui/case-embed.js";
import type { ModerationCase } from "../../database/schema.js";

export async function replyPrivately(interaction: CommandInteraction, options: Omit<InteractionReplyOptions, "ephemeral">): Promise<void> {
  const payload = { ...options, ephemeral: true, allowedMentions: { parse: [] as never[] } };
  if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
  else await interaction.reply(payload);
}

export async function replyWithCase(interaction: CommandInteraction, item: ModerationCase): Promise<void> {
  await replyPrivately(interaction, { embeds: [buildCaseEmbed(item)] });
}

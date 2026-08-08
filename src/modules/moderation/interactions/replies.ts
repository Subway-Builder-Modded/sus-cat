import type { InteractionReplyOptions } from "discord.js";

import { respond } from "../../../core/interactions/response.js";
import type { BotCommandInteraction } from "../../../core/commands/command.js";
import { buildCaseEmbed } from "../ui/case-embed.js";
import type { ModerationCase } from "../database/schema.js";

export async function replyPrivately(interaction: BotCommandInteraction, options: Omit<InteractionReplyOptions, "ephemeral">): Promise<void> {
  await respond(interaction, options);
}

export async function replyWithCase(interaction: BotCommandInteraction, item: ModerationCase): Promise<void> {
  await replyPrivately(interaction, { embeds: [buildCaseEmbed(item)] });
}

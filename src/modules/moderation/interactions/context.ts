import type { ChatInputCommandInteraction, GuildMember, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from "discord.js";

import type { BotClient } from "../../../core/bot/bot-client.js";
import { requireModerationModule } from "../moderation-module.js";

export type ModerationCommandInteraction = ChatInputCommandInteraction | UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction;

export function requireGuildInteraction(interaction: ModerationCommandInteraction): { guild: NonNullable<typeof interaction.guild>; actor: GuildMember } {
  if (!interaction.inCachedGuild()) throw new Error("This action is only available in a server.");
  return { guild: interaction.guild, actor: interaction.member };
}

export async function requireTargetMember(interaction: ChatInputCommandInteraction, option = "user"): Promise<GuildMember> {
  const { guild } = requireGuildInteraction(interaction);
  const user = interaction.options.getUser(option, true);
  return guild.members.fetch(user.id).catch(() => { throw new Error("That user is not currently a member of this server."); });
}

export function moderation(client: BotClient) {
  return requireModerationModule(client);
}

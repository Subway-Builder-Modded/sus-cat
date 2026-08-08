import type {
  ChatInputCommandInteraction,
  ContextMenuCommandBuilder,
  MessageContextMenuCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  UserContextMenuCommandInteraction,
} from "discord.js";

import type { BotClient } from "../bot/bot-client.js";

export type BotCommandInteraction = ChatInputCommandInteraction | UserContextMenuCommandInteraction | MessageContextMenuCommandInteraction;
export type BotCommandBuilder = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder | ContextMenuCommandBuilder;

export type InteractionAcknowledgement = "defer-ephemeral" | "defer-public" | "immediate" | "modal";

export interface CommandRequirements {
  readonly moduleId?: string;
  readonly featureId?: string;
  readonly capability?: string;
  readonly guildOnly?: boolean;
  readonly setupRequired?: boolean;
  readonly acknowledgement: InteractionAcknowledgement;
}

export interface BotCommand {
  readonly data: BotCommandBuilder;
  readonly requirements: CommandRequirements;
  execute(client: BotClient, interaction: BotCommandInteraction): Promise<void>;
}

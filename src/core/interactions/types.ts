import type { ButtonInteraction, ChannelSelectMenuInteraction, ModalSubmitInteraction, RoleSelectMenuInteraction, StringSelectMenuInteraction } from "discord.js";

export type RoutedComponentInteraction = ButtonInteraction | StringSelectMenuInteraction | ChannelSelectMenuInteraction | RoleSelectMenuInteraction | ModalSubmitInteraction;

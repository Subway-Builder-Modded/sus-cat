import { ActionRowBuilder, ApplicationCommandType, ContextMenuCommandBuilder, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle } from "discord.js";

import type { BotCommand } from "../../../../core/commands/command.js";
import { componentId } from "../../utils/custom-id.js";

export default {
  data: new ContextMenuCommandBuilder().setName("Add Message as Evidence").setType(ApplicationCommandType.Message),
  requirements: { moduleId: "moderation", featureId: "evidence", nativeUserPermission: PermissionFlagsBits.ViewAuditLog, guildOnly: true, setupRequired: true, acknowledgement: "modal" },
  async execute(_client, interaction) {
    if (!interaction.isMessageContextMenuCommand() || !interaction.inCachedGuild()) return;
    const message = interaction.targetMessage;
    await interaction.showModal(new ModalBuilder().setCustomId(componentId("modal_message_evidence", interaction.user.id, message.author.id, message.channel.id, message.id)).setTitle("Add Message as Evidence").addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("description").setLabel("Description (optional)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
    ));
  },
} satisfies BotCommand;

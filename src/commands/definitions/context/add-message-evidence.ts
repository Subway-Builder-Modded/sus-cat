import { ApplicationCommandType, ContextMenuCommandBuilder, ModalBuilder, PermissionFlagsBits, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

import type { BotCommand } from "../../command.js";
import { moderation, requireGuildInteraction } from "../../../moderation/interactions/context.js";
import { requireCapability } from "../../../moderation/permissions/capabilities.js";
import { componentId } from "../../../moderation/utils/custom-id.js";

export default {
  data: new ContextMenuCommandBuilder().setName("Add Message as Evidence").setType(ApplicationCommandType.Message).setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(client, interaction) {
    if (!interaction.isMessageContextMenuCommand()) return;
    const { guild, actor } = requireGuildInteraction(interaction);
    const module = moderation(client);
    requireCapability(actor, "moderation.evidence.manage", await module.configs.get(guild.id));
    const message = interaction.targetMessage;
    const modal = new ModalBuilder().setCustomId(componentId("modal_evidence_message", actor.id, message.channel.id, message.id)).setTitle("Add Message as Evidence").addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("case_number").setLabel("Case number").setPlaceholder("1842").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)),
      new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("description").setLabel("Description (optional)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500)),
    );
    await interaction.showModal(modal);
  },
} satisfies BotCommand;

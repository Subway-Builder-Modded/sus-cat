import { ActionRowBuilder, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

import type { BotCommand } from "../command.js";
import { componentId } from "../../interactions/custom-id.js";
import { requireConfigurationAccess } from "../../permissions/configuration.js";

export default {
  data: new SlashCommandBuilder().setName("resetsetup").setDescription("Permanently reset this server's bot configuration and module data"),
  requirements: { acknowledgement: "modal", guildOnly: true, setupRequired: true },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
    await requireConfigurationAccess(client.platform.settings, interaction.member);
    const modal = new ModalBuilder()
      .setCustomId(componentId("core", "setup", "reset_modal", interaction.user.id))
      .setTitle("Reset all bot data")
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId("guild_name")
          .setLabel("Type the server name to confirm")
          .setPlaceholder(interaction.guild.name.slice(0, 100))
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(100),
      ));
    await interaction.showModal(modal);
  },
} satisfies BotCommand;

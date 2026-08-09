import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import type { BotCommand } from "../../../core/commands/command.js";
import { moduleConfigurationView } from "../../../core/config/views.js";
import { requireConfigurationAccess } from "../../../core/permissions/configuration.js";
import { respond } from "../../../core/interactions/response.js";

export default {
  data: new SlashCommandBuilder().setName("moderation").setDescription("Moderation configuration and administration").addSubcommand((command) => command.setName("config").setDescription("Open the complete Moderation configuration dashboard")),
  requirements: { nativeUserPermission: PermissionFlagsBits.ManageGuild, guildOnly: true, setupRequired: true, acknowledgement: "defer-ephemeral" },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
    await requireConfigurationAccess(client.platform.settings, interaction.member);
    await respond(interaction, await moduleConfigurationView(client.platform.settings, client.platform.modules, interaction.guildId, "moderation", interaction.user.id));
  },
} satisfies BotCommand;

import { SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../command.js";
import { requireConfigurationAccess } from "../../permissions/configuration.js";
import { configurationHome } from "../../config/views.js";
import { respond } from "../../interactions/response.js";

export default {
  data: new SlashCommandBuilder().setName("config").setDescription("Open the server configuration dashboard"),
  requirements: { acknowledgement: "defer-ephemeral", guildOnly: true, setupRequired: true },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
    await requireConfigurationAccess(client.platform.settings, interaction.member);
    await respond(interaction, await configurationHome(client.platform.settings, client.platform.modules, interaction.guildId, interaction.user.id));
  },
} satisfies BotCommand;

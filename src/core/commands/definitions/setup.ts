import { SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../command.js";
import { requireConfigurationAccess } from "../../permissions/configuration.js";
import { welcomeView } from "../../setup/views.js";
import { respond } from "../../interactions/response.js";

export default {
  data: new SlashCommandBuilder().setName("setup").setDescription("Configure this server with the guided setup wizard"),
  requirements: { acknowledgement: "defer-ephemeral", guildOnly: true, setupRequired: false },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
    await requireConfigurationAccess(client.platform.settings, interaction.member);
    await client.platform.settings.ensureGuild(interaction.guildId);
    await respond(interaction, welcomeView(interaction.user.id));
  },
} satisfies BotCommand;

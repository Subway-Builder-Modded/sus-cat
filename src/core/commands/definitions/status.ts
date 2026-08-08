import { SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../command.js";
import { infoEmbed } from "../../ui/embeds.js";
import { respond } from "../../interactions/response.js";

export default {
  data: new SlashCommandBuilder().setName("status").setDescription("Show this server's bot setup status"),
  requirements: { acknowledgement: "defer-ephemeral", guildOnly: true, setupRequired: false },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;
    const status = await client.platform.settings.setupStatus(interaction.guildId);
    await respond(interaction, { embeds: [infoEmbed("Server Status", `Setup: **${status}**\nDatabase: **connected**\nModules registered: **${client.platform.modules.all().length}**`)] });
  },
} satisfies BotCommand;

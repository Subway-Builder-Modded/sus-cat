import { SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../../../core/commands/command.js";
import { documentationHome } from "../ui/views.js";
import { respond } from "../../../core/interactions/response.js";

export default {
  data: new SlashCommandBuilder().setName("help").setDescription("Browse interactive bot documentation"),
  requirements: { moduleId: "documentation", acknowledgement: "defer-ephemeral", guildOnly: true, setupRequired: true },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) return;
    const enabled = [];
    for (const module of client.modules.all()) if (await client.platform.settings.isModuleEnabled(interaction.guildId, module.manifest.id)) enabled.push(module.manifest.id);
    await respond(interaction, documentationHome(client.platform.modules, interaction.user.id, enabled));
  },
} satisfies BotCommand;

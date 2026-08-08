import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

import type { BotCommand } from "../command.js";
import { requireConfigurationAccess } from "../../permissions/configuration.js";
import { configurationHome } from "../../config/views.js";
import { warningEmbed } from "../../ui/embeds.js";
import { respond } from "../../interactions/response.js";

export default {
  data: new SlashCommandBuilder().setName("config").setDescription("Open the server configuration dashboard").setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  requirements: { acknowledgement: "defer-ephemeral", guildOnly: true, setupRequired: false },
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;
    requireConfigurationAccess(interaction.member);
    if (await client.platform.settings.setupStatus(interaction.guildId) !== "configured") {
      await respond(interaction, { embeds: [warningEmbed("Setup required", "Run `/setup` to complete initial server configuration before opening the dashboard.")] });
      return;
    }
    await respond(interaction, await configurationHome(client.platform.settings, client.platform.modules, interaction.guildId, interaction.user.id));
  },
} satisfies BotCommand;

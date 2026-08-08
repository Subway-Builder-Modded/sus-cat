import { Events } from "discord.js";

import { defineEvent } from "../bot-event.js";
import { logger } from "../../shared/logger.js";
import { toError } from "../../shared/to-error.js";
import { routeModerationComponent } from "../../moderation/interactions/component-router.js";
import { errorEmbed } from "../../moderation/ui/responses.js";
import { publicErrorMessage } from "../../moderation/ui/public-error.js";

export default defineEvent({
  name: Events.InteractionCreate,
  async execute(client, interaction) {
    if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) {
      await routeModerationComponent(client, interaction);
      return;
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) {
      logger.warn(`No handler found for command: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(client, interaction);
    } catch (error: unknown) {
      const errorId = `MOD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const normalized = toError(error);
      logger.error(`Command failed: ${interaction.commandName}`, { errorId, guildId: interaction.guildId, actorId: interaction.user.id, error: normalized.message });

      const response = { embeds: [errorEmbed(publicErrorMessage(error), errorId)], ephemeral: true, allowedMentions: { parse: [] as never[] } } as const;
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(response);
      } else {
        await interaction.reply(response);
      }
    }
  },
});

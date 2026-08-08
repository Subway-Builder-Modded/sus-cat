import { Events } from "discord.js";

import { logger } from "../../shared/logger.js";
import { defineEvent } from "../bot-event.js";

export default defineEvent({
  name: Events.GuildDelete,
  async execute(client, guild) {
    await client.platform.settings.repository.markInactive(guild.id);
    logger.info("Guild marked inactive; history preserved", { guildId: guild.id });
  },
});

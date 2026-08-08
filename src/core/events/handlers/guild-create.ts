import { Events } from "discord.js";

import { logger } from "../../shared/logger.js";
import { defineEvent } from "../bot-event.js";

export default defineEvent({
  name: Events.GuildCreate,
  async execute(client, guild) {
    await client.platform.settings.registerGuildJoin(guild.id, client.user?.id ?? "system");
    logger.info("Guild joined; setup required", { guildId: guild.id });
  },
});

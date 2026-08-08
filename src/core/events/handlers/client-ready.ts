import { Events } from "discord.js";

import { defineEvent } from "../bot-event.js";
import { logger } from "../../shared/logger.js";

export default defineEvent({
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`Connected as ${client.user?.tag ?? "unknown user"}`);
    for (const module of client.modules.all()) void module.initialize?.(client);
    client.moderation?.expirations.start(client);
  },
});

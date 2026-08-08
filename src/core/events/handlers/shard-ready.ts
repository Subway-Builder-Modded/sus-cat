import { Events } from "discord.js";

import { defineEvent } from "../bot-event.js";
import { logger } from "../../shared/logger.js";

export default defineEvent({
  name: Events.ShardReady,
  execute(_client, shardId, unavailableGuilds) {
    logger.info("Discord shard ready", { shardId, unavailableGuilds: unavailableGuilds?.size ?? 0 });
  },
});

import { Events } from "discord.js";

import { defineEvent } from "../bot-event.js";
import { logger } from "../../shared/logger.js";

export default defineEvent({
  name: Events.ShardReconnecting,
  execute(_client, shardId) {
    logger.info("Discord shard reconnecting", { shardId });
  },
});

import { Events } from "discord.js";

import { defineEvent } from "../bot-event.js";
import { logger } from "../../shared/logger.js";

export default defineEvent({
  name: Events.ShardDisconnect,
  execute(_client, event, shardId) {
    logger.warn("Discord shard disconnected; discord.js will reconnect", { shardId, code: event.code, clean: event.wasClean });
  },
});

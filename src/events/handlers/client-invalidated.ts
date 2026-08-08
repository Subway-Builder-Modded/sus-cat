import { Events } from "discord.js";

import { defineEvent } from "../bot-event.js";
import { logger } from "../../shared/logger.js";

export default defineEvent({
  name: Events.Invalidated,
  execute() {
    logger.error("Discord session invalidated; terminating for platform restart");
    setImmediate(() => {
      throw new Error("Discord session invalidated");
    });
  },
});

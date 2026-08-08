import type { BotClient } from "../bot/bot-client.js";
import { loadDefaultExports } from "../shared/load-default-exports.js";
import { logger } from "../shared/logger.js";
import { toError } from "../shared/to-error.js";
import type { BotEvent } from "./bot-event.js";

const eventDirectory = new URL("./handlers/", import.meta.url);

export async function loadEvents(client: BotClient): Promise<void> {
  const events: BotEvent[] = [...await loadDefaultExports<BotEvent>(eventDirectory), ...client.modules.all().flatMap((module) => module.events ?? []) as unknown as BotEvent[]];

  for (const event of events) {
    if (!event.name || typeof event.execute !== "function") {
      throw new TypeError("An event module has an invalid default export");
    }

    const listener = (...args: unknown[]): void => {
      Promise.resolve(event.execute(client, ...args)).catch((error: unknown) => {
        logger.error(`Event handler failed: ${event.name}`, toError(error));
      });
    };

    if (event.once) {
      client.once(event.name, listener);
    } else {
      client.on(event.name, listener);
    }
  }

  logger.info(`Loaded ${events.length} event handler(s)`);
}

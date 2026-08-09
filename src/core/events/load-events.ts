import type { BotClient } from "../bot/bot-client.js";
import { loadDefaultExports } from "../shared/load-default-exports.js";
import { logger } from "../shared/logger.js";
import { toError } from "../shared/to-error.js";
import type { BotEvent } from "./bot-event.js";

const eventDirectory = new URL("./handlers/", import.meta.url);

export async function loadEvents(client: BotClient): Promise<void> {
  const loaded = await loadDefaultExports(eventDirectory);
  const invalid = loaded.find((event) => !isBotEvent(event));
  if (invalid) throw new TypeError("An event module has an invalid default export");
  const events: BotEvent[] = [...loaded.filter(isBotEvent), ...client.modules.all().flatMap((module) => module.events ?? [])];

  for (const event of events) {
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

function isBotEvent(value: unknown): value is BotEvent {
  return typeof value === "object" && value !== null && "name" in value && typeof value.name === "string" && "execute" in value && typeof value.execute === "function";
}

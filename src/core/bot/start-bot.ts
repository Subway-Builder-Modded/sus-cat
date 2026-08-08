import type { BotClient } from "./bot-client.js";
import { loadCommands } from "../commands/load-commands.js";
import { loadEvents } from "../events/load-events.js";
import { logger } from "../shared/logger.js";
import { toError } from "../shared/to-error.js";

export async function startBot(client: BotClient, token: string): Promise<void> {
  await waitForDatabase(client);
  await loadCommands(client);
  await loadEvents(client);
  logger.info("Connecting to Discord");
  await client.login(token);
}

async function waitForDatabase(client: BotClient): Promise<void> {
  if (!client.runtime) throw new Error("The platform database is not configured");
  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      await client.runtime.database.ping();
      logger.info("Database connection ready", { attempt });
      return;
    } catch (error: unknown) {
      lastError = toError(error);
      logger.warn("Database connection attempt failed", { attempt, attemptsRemaining: 5 - attempt, error: lastError.message });
      if (attempt < 5) await delay(attempt * 2_000);
    }
  }
  throw new Error("Database did not become ready during startup", { cause: lastError });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

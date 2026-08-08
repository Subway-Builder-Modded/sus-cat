import type { BotClient } from "../bot/bot-client.js";
import { loadDefaultExports } from "../shared/load-default-exports.js";
import { logger } from "../shared/logger.js";
import type { BotCommand } from "./command.js";

const commandDirectory = new URL("./definitions/", import.meta.url);

export async function loadCommands(client: BotClient): Promise<void> {
  const commands = await loadDefaultExports<BotCommand>(commandDirectory);

  for (const command of commands) {
    if (!command.data?.name || typeof command.execute !== "function") {
      throw new TypeError("A command module has an invalid default export");
    }

    if (client.commands.has(command.data.name)) {
      throw new Error(`Duplicate command name: ${command.data.name}`);
    }

    client.commands.set(command.data.name, command);
  }

  logger.info(`Loaded ${commands.length} command(s)`);
}

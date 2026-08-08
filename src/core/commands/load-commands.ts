import type { BotClient } from "../bot/bot-client.js";
import { logger } from "../shared/logger.js";
import { coreCommands } from "./definitions/index.js";
import { validateCommands } from "./validation.js";

export async function loadCommands(client: BotClient): Promise<void> {
  const commands = [...coreCommands, ...client.modules.all().flatMap((module) => module.commands)];
  validateCommands(commands, client.modules);
  for (const command of commands) client.commands.set(command.data.name, command);
  logger.info(`Loaded ${commands.length} command(s) from ${client.modules.all().length} module(s)`, {
    ...(process.env.LOG_LEVEL === "debug" ? { commands: commands.map((command) => command.data.name) } : {}),
  });
}

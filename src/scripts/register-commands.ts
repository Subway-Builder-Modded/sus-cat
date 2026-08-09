import { REST, Routes } from "discord.js";

import { createApplicationClient } from "../create-application-client.js";
import { loadCommands } from "../core/commands/load-commands.js";
import { loadEnvironment, requiredVariable } from "../core/environment/environment.js";
import { logger } from "../core/shared/logger.js";
import { toError } from "../core/shared/to-error.js";

async function registerCommands(): Promise<void> {
  logger.info("[discord] Registering production commands");
  const environment = loadEnvironment();
  const clientId = environment.discordClientId ?? requiredVariable("DISCORD_CLIENT_ID");
  const client = createApplicationClient();
  await loadCommands(client);

  const definitions = client.commands.map((command) => command.data.toJSON());
  if (definitions.length === 0) {
    logger.warn("No command definitions found; registration skipped");
    return;
  }

  const route = environment.discordGuildId
    ? Routes.applicationGuildCommands(clientId, environment.discordGuildId)
    : Routes.applicationCommands(clientId);

  await new REST().setToken(environment.discordToken).put(route, { body: definitions });
  logger.info(`[discord] Registration complete: ${definitions.length} command(s)`);
}

registerCommands().catch((error: unknown) => {
  logger.error("Command registration failed", toError(error));
  process.exitCode = 1;
});

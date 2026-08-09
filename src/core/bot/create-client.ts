import { GatewayIntentBits } from "discord.js";

import type { ModuleRegistry } from "../modules/registry.js";
import { BotClient } from "./bot-client.js";
import { GuildConfigRepository } from "../config/repository.js";
import { GuildConfigService } from "../config/service.js";
import { createDatabase } from "../database/client.js";

export function createBotClient(modules: ModuleRegistry, databaseUrl?: string): BotClient {
  const client = new BotClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] }, modules);
  if (databaseUrl) {
    const database = createDatabase(databaseUrl);
    const settings = new GuildConfigService(new GuildConfigRepository(database.db), modules);
    client.runtime = { modules, settings, database };
  }
  return client;
}

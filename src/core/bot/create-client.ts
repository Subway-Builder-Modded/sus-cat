import { GatewayIntentBits } from "discord.js";

import { createModuleRegistry } from "../../modules/index.js";
import { createModerationModule } from "../../modules/moderation/moderation-module.js";
import { BotClient } from "./bot-client.js";
import { GuildConfigRepository } from "../config/repository.js";
import { GuildConfigService } from "../config/service.js";
import { createDatabase } from "../database/client.js";

export function createBotClient(databaseUrl?: string): BotClient {
  const modules = createModuleRegistry();
  const client = new BotClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] }, modules);
  if (databaseUrl) {
    const database = createDatabase(databaseUrl);
    const settings = new GuildConfigService(new GuildConfigRepository(database.db), modules);
    client.runtime = { modules, settings, database };
    client.moderation = createModerationModule(database.db, settings);
  }
  return client;
}

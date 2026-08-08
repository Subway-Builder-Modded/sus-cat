import { GatewayIntentBits } from "discord.js";

import { BotClient } from "./bot-client.js";
import { createModerationModule } from "../moderation/moderation-module.js";

export function createBotClient(databaseUrl?: string): BotClient {
  const client = new BotClient({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  });

  if (databaseUrl) client.moderation = createModerationModule(databaseUrl);
  return client;
}

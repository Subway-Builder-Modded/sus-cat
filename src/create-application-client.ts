import { createBotClient } from "./core/bot/create-client.js";
import { createModuleRegistry } from "./modules/index.js";
import { createModerationModule } from "./modules/moderation/moderation-module.js";

export function createApplicationClient(databaseUrl?: string) {
  const client = createBotClient(createModuleRegistry(), databaseUrl);
  if (client.runtime) {
    client.registerModuleService(
      "moderation",
      createModerationModule(client.runtime.database.db, client.runtime.settings),
    );
  }
  return client;
}

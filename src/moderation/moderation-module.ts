import { createDatabase } from "../database/client.js";
import { CaseRepository } from "./repositories/case-repository.js";
import { ConfigRepository } from "./repositories/config-repository.js";
import { LockRepository } from "./repositories/lock-repository.js";
import { ChannelModerationService } from "./services/channel-moderation-service.js";
import { ExpirationService } from "./services/expiration-service.js";
import { ModerationService } from "./services/moderation-service.js";
import { ConfirmationStore } from "./interactions/confirmation-store.js";
import { SearchSessionStore } from "./interactions/search-session-store.js";

export interface ModerationModule {
  readonly cases: CaseRepository;
  readonly configs: ConfigRepository;
  readonly moderation: ModerationService;
  readonly channels: ChannelModerationService;
  readonly expirations: ExpirationService;
  readonly confirmations: ConfirmationStore;
  readonly searches: SearchSessionStore;
  healthCheck(): Promise<void>;
  close(): Promise<void>;
}

export function createModerationModule(databaseUrl: string): ModerationModule {
  const database = createDatabase(databaseUrl);
  const cases = new CaseRepository(database.db);
  const configs = new ConfigRepository(database.db);
  const locks = new LockRepository(database.db);
  const expirations = new ExpirationService(cases);
  return {
    cases,
    configs,
    moderation: new ModerationService(cases, configs),
    channels: new ChannelModerationService(configs, locks, cases),
    expirations,
    confirmations: new ConfirmationStore(),
    searches: new SearchSessionStore(),
    healthCheck: database.ping,
    close: async () => {
      expirations.stop();
      await database.close();
    },
  };
}

export function requireModerationModule(client: import("../bot/bot-client.js").BotClient): ModerationModule {
  if (!client.moderation) throw new Error("The moderation database is not configured.");
  return client.moderation;
}

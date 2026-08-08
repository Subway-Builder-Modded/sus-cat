import type { Database } from "../../core/database/client.js";
import type { GuildConfigService } from "../../core/config/service.js";
import { CaseRepository } from "./repositories/case-repository.js";
import { ModerationSettings } from "./config/settings.js";
import { LockRepository } from "./repositories/lock-repository.js";
import { ChannelModerationService } from "./services/channel-moderation-service.js";
import { ExpirationService } from "./services/expiration-service.js";
import { ModerationService } from "./services/moderation-service.js";
import { ConfirmationStore } from "./interactions/confirmation-store.js";
import { SearchSessionStore } from "./interactions/search-session-store.js";

export interface ModerationModule {
  readonly cases: CaseRepository;
  readonly configs: ModerationSettings;
  readonly moderation: ModerationService;
  readonly channels: ChannelModerationService;
  readonly expirations: ExpirationService;
  readonly confirmations: ConfirmationStore;
  readonly searches: SearchSessionStore;
  close(): void;
}

export function createModerationModule(database: Database, settings: GuildConfigService): ModerationModule {
  const cases = new CaseRepository(database);
  const configs = new ModerationSettings(settings);
  const locks = new LockRepository(database);
  const expirations = new ExpirationService(cases);
  return {
    cases,
    configs,
    moderation: new ModerationService(cases, configs),
    channels: new ChannelModerationService(configs, locks, cases),
    expirations,
    confirmations: new ConfirmationStore(),
    searches: new SearchSessionStore(),
    close: () => {
      expirations.stop();
    },
  };
}

export function requireModerationModule(client: import("../../core/bot/bot-client.js").BotClient): ModerationModule {
  if (!client.moderation) throw new Error("The moderation database is not configured.");
  return client.moderation;
}

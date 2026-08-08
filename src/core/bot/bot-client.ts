import { Client, Collection, type ClientOptions } from "discord.js";

import type { BotCommand } from "../commands/command.js";
import type { GuildConfigService } from "../config/service.js";
import type { createDatabase } from "../database/client.js";
import type { ModuleRegistry } from "../modules/registry.js";
import type { ModerationModule } from "../../modules/moderation/moderation-module.js";

export interface PlatformRuntime {
  readonly modules: ModuleRegistry;
  readonly settings: GuildConfigService;
  readonly database: ReturnType<typeof createDatabase>;
}

export class BotClient extends Client {
  readonly commands = new Collection<string, BotCommand>();
  readonly modules: ModuleRegistry;
  runtime?: PlatformRuntime;
  moderation?: ModerationModule;

  constructor(options: ClientOptions, modules: ModuleRegistry) {
    super(options);
    this.modules = modules;
  }

  get platform(): PlatformRuntime {
    if (!this.runtime) throw new Error("The platform database is not configured.");
    return this.runtime;
  }
}

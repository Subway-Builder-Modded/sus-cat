import { Client, Collection, type ClientOptions } from "discord.js";

import type { BotCommand } from "../commands/command.js";
import type { GuildConfigService } from "../config/service.js";
import type { createDatabase } from "../database/client.js";
import type { ModuleRegistry } from "../modules/registry.js";

export interface PlatformRuntime {
  readonly modules: ModuleRegistry;
  readonly settings: GuildConfigService;
  readonly database: ReturnType<typeof createDatabase>;
}

export class BotClient extends Client {
  readonly #moduleServices = new Map<string, unknown>();
  readonly commands = new Collection<string, BotCommand>();
  readonly modules: ModuleRegistry;
  runtime?: PlatformRuntime;

  constructor(options: ClientOptions, modules: ModuleRegistry) {
    super(options);
    this.modules = modules;
  }

  get platform(): PlatformRuntime {
    if (!this.runtime) throw new Error("The platform database is not configured.");
    return this.runtime;
  }

  registerModuleService(moduleId: string, service: unknown): void {
    if (this.#moduleServices.has(moduleId)) {
      throw new Error(`A runtime service is already registered for module: ${moduleId}`);
    }
    this.modules.require(moduleId);
    this.#moduleServices.set(moduleId, service);
  }

  requireModuleService<Service>(moduleId: string, isService: (value: unknown) => value is Service): Service {
    const service = this.#moduleServices.get(moduleId);
    if (!isService(service)) throw new Error(`The ${moduleId} module runtime is not configured correctly.`);
    return service;
  }

  async closeModuleServices(): Promise<void> {
    for (const service of this.#moduleServices.values()) {
      if (hasCloseMethod(service)) await service.close();
    }
    this.#moduleServices.clear();
  }
}

function hasCloseMethod(value: unknown): value is { close(): void | Promise<void> } {
  return typeof value === "object" && value !== null && "close" in value && typeof value.close === "function";
}

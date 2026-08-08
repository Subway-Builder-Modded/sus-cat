import { ModuleRegistry } from "../core/modules/registry.js";
import { documentationModule } from "./documentation/index.js";
import { moderationModule } from "./moderation/index.js";

export function createModuleRegistry(): ModuleRegistry {
  const registry = new ModuleRegistry();
  registry.register(moderationModule);
  registry.register(documentationModule);
  registry.validateDependencies();
  return registry;
}

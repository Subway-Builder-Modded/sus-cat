import { ApplicationCommandOptionType, type RESTPostAPIApplicationCommandsJSONBody } from "discord.js";

import type { ModuleRegistry } from "../modules/registry.js";
import type { BotCommand } from "./command.js";

export function validateCommands(commands: readonly BotCommand[], modules: ModuleRegistry): void {
  const names = new Set<string>();
  for (const command of commands) {
    const json = command.data.toJSON() as RESTPostAPIApplicationCommandsJSONBody;
    if (!json.name || typeof command.execute !== "function") throw new Error("A command definition is missing a name or handler.");
    if (names.has(json.name)) throw new Error(`Duplicate command name: ${json.name}`);
    names.add(json.name);
    if (!command.requirements?.acknowledgement) throw new Error(`Command ${json.name} has no acknowledgement policy.`);
    const moduleId = command.requirements.moduleId;
    if (moduleId) {
      const module = modules.require(moduleId);
      const featureId = command.requirements.featureId;
      if (featureId && !module.manifest.features.some((feature) => feature.id === featureId)) throw new Error(`Command ${json.name} references unknown feature ${moduleId}.${featureId}.`);
    }
    validateOptionOrder((json.options ?? []) as CommandOption[], json.name);
  }
}

type CommandOption = { readonly type: number; readonly name: string; readonly required?: boolean | undefined; readonly options?: readonly CommandOption[] | undefined };

function validateOptionOrder(options: readonly CommandOption[], path: string): void {
  let optionalSeen = false;
  for (const option of options) {
    if (option.type === ApplicationCommandOptionType.Subcommand || option.type === ApplicationCommandOptionType.SubcommandGroup) validateOptionOrder(option.options ?? [], `${path} ${option.name}`);
    else if (option.required) {
      if (optionalSeen) throw new Error(`Required option ${path} ${option.name} appears after an optional option.`);
    } else optionalSeen = true;
  }
}

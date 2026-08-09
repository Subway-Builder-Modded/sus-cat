import type { Interaction } from "discord.js";

import type { BotClient } from "../bot/bot-client.js";
import { handleConfigComponent } from "../config/handler.js";
import { handleSetupComponent } from "../setup/handler.js";
import { logger } from "../shared/logger.js";
import { toError } from "../shared/to-error.js";
import { errorEmbed } from "../ui/embeds.js";
import { parseComponentId } from "./custom-id.js";
import { deferEphemeral, respond } from "./response.js";

export async function routeComponent(client: BotClient, interaction: Interaction): Promise<void> {
  if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu() && !interaction.isRoleSelectMenu() && !interaction.isModalSubmit()) return;
  const route = parseComponentId(interaction.customId);
  if (!route) return;
  try {
    if (interaction.isModalSubmit()) await deferEphemeral(interaction);
    if (route.namespace === "core") {
      if (interaction.isMessageComponent() && coreAcknowledgement(route.owner, route.action) === "defer-update") await interaction.deferUpdate();
      if (route.owner === "setup") await handleSetupComponent(client, interaction, route.action, route.parts);
      else if (route.owner === "config") await handleConfigComponent(client, interaction, route.action, route.parts);
      else throw new Error("This core control is no longer supported.");
      return;
    }
    const module = client.modules.require(route.owner);
    if (interaction.isMessageComponent() && (module.componentAcknowledgement?.(route.action) ?? "defer-update") === "defer-update") await interaction.deferUpdate();
    if (!interaction.guildId) throw new Error("This control can only be used in a server.");
    if (await client.platform.settings.setupStatus(interaction.guildId) !== "configured") throw new Error("This server has not completed setup. Run `/setup` before using other bot controls.");
    const isConfigurationComponent = module.isConfigurationComponent?.(route.action) ?? false;
    if (!isConfigurationComponent && !await client.platform.settings.isModuleEnabled(interaction.guildId, route.owner)) throw new Error(`${module.manifest.name} is disabled in this server.`);
    const feature = module.featureForComponent?.(route.action);
    if (!isConfigurationComponent && feature && !await client.platform.settings.isFeatureEnabled(interaction.guildId, route.owner, feature)) throw new Error(`${module.manifest.features.find((item) => item.id === feature)?.name ?? feature} is disabled in this server.`);
    if (!isConfigurationComponent && feature) {
      const definition = module.manifest.features.find((item) => item.id === feature);
      if ((definition?.requiredBotPermissions ?? []).some((permission) => !interaction.appPermissions?.has(permission))) throw new Error(`I am missing Discord permissions required by ${definition?.name ?? feature}.`);
    }
    if (!isConfigurationComponent) {
      const issue = (await client.platform.settings.configurationIssues(interaction.guildId, route.owner))[0];
      if (issue) throw new Error(`Configuration required: ${issue.message}.`);
    }
    if (!module.handleComponent) throw new Error("This module does not handle interactive controls.");
    await module.handleComponent(client, interaction, route.action, route.parts);
  } catch (error: unknown) {
    const errorId = `UI-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    logger.error("Component interaction failed", { errorId, guildId: interaction.guildId, actorId: interaction.user.id, route: `${route.namespace}:${route.owner}:${route.action}`, error: toError(error).message });
    await respond(interaction, { embeds: [errorEmbed("Control failed", `${toError(error).message}\n\nReference: \`${errorId}\``)] }).catch(() => undefined);
  }
}

function coreAcknowledgement(owner: string, action: string): "defer-update" | "modal" {
  if (owner === "setup" && action === "config_field") return "modal";
  if (owner === "config" && action === "edit_field") return "modal";
  return "defer-update";
}

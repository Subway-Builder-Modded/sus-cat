import type { BotClient } from "../bot/bot-client.js";
import { deferEphemeral, respond } from "../interactions/response.js";
import { errorEmbed, warningEmbed } from "../ui/embeds.js";
import { logger } from "../shared/logger.js";
import { toError } from "../shared/to-error.js";
import type { BotCommand, BotCommandInteraction } from "./command.js";
import { isBotAdmin } from "../permissions/configuration.js";

export async function dispatchCommand(client: BotClient, interaction: BotCommandInteraction): Promise<void> {
  const command = client.commands.get(interaction.commandName);
  if (!command) {
    logger.warn(`No handler found for command: ${interaction.commandName}`);
    await respond(interaction, { embeds: [warningEmbed("Command unavailable", "This command is registered but is not loaded by this deployment.")] });
    return;
  }
  const startedAt = Date.now();
  const context = { interactionId: interaction.id, guildId: interaction.guildId, userId: interaction.user.id, command: interaction.commandName, module: command.requirements.moduleId ?? "core", feature: command.requirements.featureId ?? null };
  logger.info("Command interaction received", context);
  try {
    await acknowledge(interaction, command);
    await enforceCommandGate(client, interaction, command);
    await command.execute(client, interaction);
    logger.info("Command interaction completed", { ...context, acknowledged: interaction.deferred || interaction.replied, durationMs: Date.now() - startedAt });
  } catch (error: unknown) {
    const errorId = `CMD-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    logger.error("Command interaction failed", { ...context, errorId, acknowledged: interaction.deferred || interaction.replied, error: toError(error).message });
    await respond(interaction, { embeds: [errorEmbed("Command failed", `${publicMessage(error)}\n\nReference: \`${errorId}\``)] }).catch((responseError: unknown) => logger.error("Unable to deliver command error", { errorId, error: toError(responseError).message }));
  }
}

async function acknowledge(interaction: BotCommandInteraction, command: BotCommand): Promise<void> {
  if (command.requirements.acknowledgement === "defer-ephemeral") await deferEphemeral(interaction);
  else if (command.requirements.acknowledgement === "defer-public") await interaction.deferReply();
}

export async function enforceCommandGate(client: BotClient, interaction: BotCommandInteraction, command: BotCommand): Promise<void> {
  const requirements = command.requirements;
  if (requirements.guildOnly && !interaction.guildId) throw new Error("This command can only be used in a server.");
  if (!interaction.guildId) return;
  const setupStatus = await client.platform.settings.setupStatus(interaction.guildId);
  if (requirements.setupRequired !== false && setupStatus !== "configured") throw new Error("This server has not completed setup. Ask an administrator to run `/setup`.");
  if (requirements.nativeUserPermission && interaction.inCachedGuild()) {
    const native = interaction.member.permissions.has(requirements.nativeUserPermission);
    const botAdmin = await isBotAdmin(client.platform.settings, interaction.member);
    const moduleAuthorized = requirements.moduleId
      ? await client.modules.require(requirements.moduleId).authorizeCommand?.(client, interaction, requirements.nativeUserPermission) ?? false
      : false;
    if (!native && !botAdmin && !moduleAuthorized) throw new Error("You do not have permission to use this command in this server.");
  }
  if (!requirements.moduleId) return;
  const module = client.modules.require(requirements.moduleId);
  if (!await client.platform.settings.isModuleEnabled(interaction.guildId, requirements.moduleId)) throw new Error(`${module.manifest.name} is disabled in this server.`);
  if (requirements.featureId && !await client.platform.settings.isFeatureEnabled(interaction.guildId, requirements.moduleId, requirements.featureId)) {
    const feature = client.modules.require(requirements.moduleId).manifest.features.find((item) => item.id === requirements.featureId);
    throw new Error(`${feature?.name ?? requirements.featureId} is disabled in this server.`);
  }
  if (requirements.featureId) {
    const feature = client.modules.require(requirements.moduleId).manifest.features.find((item) => item.id === requirements.featureId);
    const missing = (feature?.requiredBotPermissions ?? []).filter((permission) => !interaction.appPermissions?.has(permission));
    if (missing.length) throw new Error(`I am missing Discord permissions required by ${feature?.name ?? requirements.featureId}.`);
  }
  const issues = await client.platform.settings.configurationIssues(interaction.guildId, requirements.moduleId);
  const issue = issues.find((item) => item.moduleId === requirements.moduleId);
  if (issue) throw new Error(`Configuration required: ${issue.message}. An administrator can fix this with \`/config\`.`);
}

function publicMessage(error: unknown): string {
  const message = toError(error).message;
  return message.length <= 500 ? message : "The command could not be completed.";
}

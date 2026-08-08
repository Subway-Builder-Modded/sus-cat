import { PermissionsBitField, type Guild, type InteractionUpdateOptions } from "discord.js";
import type { BotClient } from "../bot/bot-client.js";
import type { RoutedComponentInteraction } from "../interactions/types.js";
import { respond, type SafeReplyOptions } from "../interactions/response.js";
import { requireConfigurationAccess } from "../permissions/configuration.js";
import { successEmbed } from "../ui/embeds.js";
import { featureSelectionView, moduleSelectionView, reviewView, setupConfigurationView } from "./views.js";

export async function handleSetupComponent(client: BotClient, interaction: RoutedComponentInteraction, action: string, parts: readonly string[]): Promise<void> {
  if (!interaction.inCachedGuild()) throw new Error("Setup is only available in a server.");
  requireConfigurationAccess(interaction.member);
  const actorId = required(parts, 0);
  if (actorId !== interaction.user.id) throw new Error("This setup panel belongs to another administrator.");
  const { settings, modules } = client.platform;

  if (action === "start" || action === "back") {
    await settings.beginSetup(interaction.guildId, interaction.user.id);
    await update(interaction, await moduleSelectionView(settings, modules, interaction.guildId, actorId));
    return;
  }
  if (action === "modules" && interaction.isStringSelectMenu()) {
    for (const module of modules.all()) await settings.setModuleEnabled(interaction.guildId, module.manifest.id, interaction.values.includes(module.manifest.id), actorId);
    const first = modules.all().find((module) => interaction.values.includes(module.manifest.id));
    await update(interaction, first ? await featureSelectionView(settings, modules, interaction.guildId, first.manifest.id, actorId) : await reviewView(settings, modules, interaction.guildId, actorId, await setupPermissionIssues(interaction.guild, client)));
    return;
  }
  if (action === "features" && interaction.isStringSelectMenu()) {
    const moduleId = required(parts, 1);
    const module = modules.require(moduleId);
    for (const feature of [...module.manifest.features].reverse()) if (!interaction.values.includes(feature.id)) await settings.setFeatureEnabled(interaction.guildId, moduleId, feature.id, false, actorId);
    for (const feature of module.manifest.features) if (interaction.values.includes(feature.id)) await settings.setFeatureEnabled(interaction.guildId, moduleId, feature.id, true, actorId);
    await update(interaction, await setupConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
    return;
  }
  if (action === "channel" && interaction.isChannelSelectMenu()) {
    await settings.setConfig(interaction.guildId, required(parts, 1), required(parts, 2), required(interaction.values, 0), actorId);
    await update(interaction, await setupConfigurationView(settings, modules, interaction.guildId, required(parts, 1), actorId));
    return;
  }
  if (action === "roles" && interaction.isRoleSelectMenu()) {
    await settings.setConfig(interaction.guildId, required(parts, 1), required(parts, 2), interaction.values, actorId);
    await update(interaction, await setupConfigurationView(settings, modules, interaction.guildId, required(parts, 1), actorId));
    return;
  }
  if (action === "continue") {
    const currentId = required(parts, 1);
    const enabled = [];
    for (const module of modules.all()) if (await settings.isModuleEnabled(interaction.guildId, module.manifest.id)) enabled.push(module);
    const next = enabled[enabled.findIndex((module) => module.manifest.id === currentId) + 1];
    await update(interaction, next ? await featureSelectionView(settings, modules, interaction.guildId, next.manifest.id, actorId) : await reviewView(settings, modules, interaction.guildId, actorId, await setupPermissionIssues(interaction.guild, client)));
    return;
  }
  if (action === "finish") {
    const permissionIssues = await setupPermissionIssues(interaction.guild, client);
    if (permissionIssues.length) throw new Error(`Missing bot permissions: ${permissionIssues.join("; ")}`);
    await validateSelectedChannels(client, interaction.guildId);
    await settings.completeSetup(interaction.guildId, actorId);
    await update(interaction, { embeds: [successEmbed("Setup complete", "This server is configured. Enabled module commands are available immediately; use `/config` to make changes.")], components: [] });
  }
}

async function validateSelectedChannels(client: BotClient, guildId: string): Promise<void> {
  const guild = await client.guilds.fetch(guildId);
  for (const module of client.platform.modules.all()) {
    if (!await client.platform.settings.isModuleEnabled(guildId, module.manifest.id)) continue;
    const config = await client.platform.settings.getModuleConfig(guildId, module.manifest.id);
    for (const definition of module.manifest.config.filter((item) => item.type === "channel")) {
      const value = config[definition.key];
      if (typeof value !== "string" || !value) continue;
      const channel = await guild.channels.fetch(value).catch(() => undefined);
      if (!channel?.isSendable()) throw new Error(`${definition.label} no longer exists or cannot receive messages.`);
      const permissions = channel.permissionsFor(guild.members.me!);
      if (!permissions?.has(["ViewChannel", "SendMessages", "EmbedLinks"])) throw new Error(`I need View Channel, Send Messages, and Embed Links in ${channel}.`);
    }
  }
}

async function botPermissionIssues(guild: Guild, client: BotClient): Promise<string[]> {
  const me = guild.members.me ?? await guild.members.fetchMe();
  const issues = new Set<string>();
  for (const module of client.modules.all()) if (await client.platform.settings.isModuleEnabled(guild.id, module.manifest.id)) {
    for (const feature of module.manifest.features) if (await client.platform.settings.isFeatureEnabled(guild.id, module.manifest.id, feature.id)) {
      for (const permission of feature.requiredBotPermissions ?? []) if (!me.permissions.has(permission)) {
        const names = new PermissionsBitField(permission).toArray().join(", ");
        issues.add(`${names} — required by ${module.manifest.name} → ${feature.name}`);
      }
    }
  }
  return [...issues];
}

async function setupPermissionIssues(guild: Guild, client: BotClient): Promise<string[]> {
  const issues = await botPermissionIssues(guild, client);
  for (const module of client.modules.all()) {
    if (!await client.platform.settings.isModuleEnabled(guild.id, module.manifest.id)) continue;
    const config = await client.platform.settings.getModuleConfig(guild.id, module.manifest.id);
    for (const definition of module.manifest.config.filter((item) => item.type === "channel")) {
      const channelId = config[definition.key];
      if (typeof channelId !== "string" || !channelId) continue;
      const channel = await guild.channels.fetch(channelId).catch(() => undefined);
      if (!channel?.isSendable()) issues.push(`${definition.label} no longer exists or cannot receive messages`);
      else if (!channel.permissionsFor(guild.members.me!)?.has(["ViewChannel", "SendMessages", "EmbedLinks"])) issues.push(`View Channel, Send Messages, and Embed Links — required in ${definition.label}`);
    }
  }
  return issues;
}

async function update(interaction: RoutedComponentInteraction, payload: InteractionUpdateOptions): Promise<void> {
  if (interaction.isMessageComponent()) await interaction.update(payload);
  else await respond(interaction, payload as SafeReplyOptions);
}

function required(values: readonly string[], index: number): string {
  const value = values[index];
  if (!value) throw new Error("This setup control is incomplete or stale.");
  return value;
}

import { PermissionsBitField, type Guild, type InteractionUpdateOptions } from "discord.js";
import { eq } from "drizzle-orm";

import type { BotClient } from "../bot/bot-client.js";
import { configurationAuditEvents, guildFeatures, guildModules, guildSettings } from "../database/schema.js";
import type { RoutedComponentInteraction } from "../interactions/types.js";
import { respond, type SafeReplyOptions } from "../interactions/response.js";
import { requireConfigurationAccess } from "../permissions/configuration.js";
import { successEmbed } from "../ui/embeds.js";
import { botAdminRolesView, featureSelectionView, moduleSelectionView, reviewView, setupConfigurationView, setupFieldEditor, welcomeView } from "./views.js";

export async function handleSetupComponent(client: BotClient, interaction: RoutedComponentInteraction, action: string, parts: readonly string[]): Promise<void> {
  if (!interaction.inCachedGuild()) throw new Error("Setup is only available in a server.");
  await requireConfigurationAccess(client.platform.settings, interaction.member);
  const actorId = required(parts, 0);
  if (actorId !== interaction.user.id) throw new Error("This setup panel belongs to another administrator.");
  const { settings, modules } = client.platform;

  if (action === "reset_modal" && interaction.isModalSubmit()) {
    if (interaction.fields.getTextInputValue("guild_name") !== interaction.guild.name) throw new Error("The server name did not match. Nothing was reset.");
    await client.platform.database.db.transaction(async (tx) => {
      for (const module of modules.all()) await module.resetGuild?.(interaction.guildId, tx);
      await tx.delete(configurationAuditEvents).where(eq(configurationAuditEvents.guildId, interaction.guildId));
      await tx.delete(guildFeatures).where(eq(guildFeatures.guildId, interaction.guildId));
      await tx.delete(guildModules).where(eq(guildModules.guildId, interaction.guildId));
      await tx.delete(guildSettings).where(eq(guildSettings.guildId, interaction.guildId));
    });
    await respond(interaction, { embeds: [successEmbed("Server reset complete", "Setup, roles, module configuration, cases, evidence, counters, and module-owned guild data were removed. Run `/setup` to configure the server again.")] });
    return;
  }

  if (action === "start") {
    await settings.beginSetup(interaction.guildId, interaction.user.id);
    return update(interaction, await botAdminRolesView(settings, interaction.guildId, actorId));
  }
  if (action === "welcome") return update(interaction, welcomeView(actorId));
  if (action === "back_admin") return update(interaction, await botAdminRolesView(settings, interaction.guildId, actorId));
  if (action === "admin_roles" && interaction.isRoleSelectMenu()) {
    await settings.setBotAdminRoles(interaction.guildId, interaction.values, actorId);
    return update(interaction, await botAdminRolesView(settings, interaction.guildId, actorId));
  }
  if (action === "continue_admin") return update(interaction, await moduleSelectionView(settings, modules, interaction.guildId, actorId));
  if (action === "modules" && interaction.isStringSelectMenu()) {
    for (const module of modules.all()) await settings.setModuleEnabled(interaction.guildId, module.manifest.id, interaction.values.includes(module.manifest.id), actorId);
    return update(interaction, await moduleSelectionView(settings, modules, interaction.guildId, actorId));
  }
  if (action === "continue_modules") {
    const enabled = await enabledModules(client, interaction.guildId);
    return update(interaction, enabled[0] ? await featureSelectionView(settings, modules, interaction.guildId, enabled[0].manifest.id, actorId) : await review(client, interaction.guild, actorId));
  }
  if (action === "features" && interaction.isStringSelectMenu()) {
    const moduleId = required(parts, 1);
    const module = modules.require(moduleId);
    for (const feature of [...module.manifest.features].reverse()) if (!interaction.values.includes(feature.id)) await settings.setFeatureEnabled(interaction.guildId, moduleId, feature.id, false, actorId);
    for (const feature of module.manifest.features) if (interaction.values.includes(feature.id)) await settings.setFeatureEnabled(interaction.guildId, moduleId, feature.id, true, actorId);
    return update(interaction, await featureSelectionView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "back_features") {
    const moduleId = required(parts, 1);
    const enabled = await enabledModules(client, interaction.guildId);
    const previous = enabled[enabled.findIndex((module) => module.manifest.id === moduleId) - 1];
    return update(interaction, previous ? await setupConfigurationView(settings, modules, interaction.guildId, previous.manifest.id, actorId) : await moduleSelectionView(settings, modules, interaction.guildId, actorId));
  }
  if (action === "continue_features") return update(interaction, await setupConfigurationView(settings, modules, interaction.guildId, required(parts, 1), actorId));
  if (action === "config_home") return update(interaction, await setupConfigurationView(settings, modules, interaction.guildId, required(parts, 1), actorId));
  if (action === "config_field" && interaction.isStringSelectMenu()) {
    const moduleId = required(parts, 1), key = required(interaction.values, 0), editor = await setupFieldEditor(settings, modules, interaction.guildId, moduleId, key, actorId);
    if ("modal" in editor) await interaction.showModal(editor.modal); else await update(interaction, editor.view);
    return;
  }
  if (action === "config_channel" && interaction.isChannelSelectMenu()) {
    const moduleId = required(parts, 1), key = required(parts, 2), definition = modules.require(moduleId).manifest.config.find((item) => item.key === key);
    if (!definition) throw new Error("That setup field no longer exists.");
    await settings.setConfig(interaction.guildId, moduleId, key, definition.type === "channel-list" ? interaction.values : interaction.values[0] ?? null, actorId);
    return update(interaction, await setupConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "config_role" && interaction.isRoleSelectMenu()) {
    const moduleId = required(parts, 1), key = required(parts, 2), definition = modules.require(moduleId).manifest.config.find((item) => item.key === key);
    if (!definition) throw new Error("That setup field no longer exists.");
    await settings.setConfig(interaction.guildId, moduleId, key, definition.type === "role-list" ? interaction.values : interaction.values[0] ?? null, actorId);
    return update(interaction, await setupConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "config_value" && interaction.isStringSelectMenu()) {
    const moduleId = required(parts, 1), key = required(parts, 2);
    await settings.setConfig(interaction.guildId, moduleId, key, required(interaction.values, 0), actorId);
    return update(interaction, await setupConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "config_boolean" && interaction.isButton()) {
    const moduleId = required(parts, 1), key = required(parts, 2);
    await settings.setConfig(interaction.guildId, moduleId, key, required(parts, 3) === "true", actorId);
    return update(interaction, await setupConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "config_modal" && interaction.isModalSubmit()) {
    const moduleId = required(parts, 1), key = required(parts, 2), definition = modules.require(moduleId).manifest.config.find((item) => item.key === key);
    if (!definition) throw new Error("That setup field no longer exists.");
    const raw = interaction.fields.getTextInputValue("value").trim();
    const value = definition.type === "integer" || definition.type === "duration" ? raw ? Number(raw) : null : definition.type === "string-list" ? raw.split(/[\n,]/).map((item) => item.trim()).filter(Boolean) : raw;
    await settings.setConfig(interaction.guildId, moduleId, key, value, actorId);
    return update(interaction, await setupConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "back_config") return update(interaction, await featureSelectionView(settings, modules, interaction.guildId, required(parts, 1), actorId));
  if (action === "continue_config") {
    const currentId = required(parts, 1);
    const enabled = await enabledModules(client, interaction.guildId);
    const next = enabled[enabled.findIndex((module) => module.manifest.id === currentId) + 1];
    return update(interaction, next ? await featureSelectionView(settings, modules, interaction.guildId, next.manifest.id, actorId) : await review(client, interaction.guild, actorId));
  }
  if (action === "back_review") {
    const enabled = await enabledModules(client, interaction.guildId);
    const previous = enabled.at(-1);
    return update(interaction, previous ? await setupConfigurationView(settings, modules, interaction.guildId, previous.manifest.id, actorId) : await moduleSelectionView(settings, modules, interaction.guildId, actorId));
  }
  if (action === "finish") {
    const permissionIssues = await setupPermissionIssues(interaction.guild, client);
    if (permissionIssues.length) throw new Error(`Missing bot permissions: ${permissionIssues.join("; ")}`);
    await validateSelectedChannels(client, interaction.guildId);
    await settings.completeSetup(interaction.guildId, actorId);
    await update(interaction, { embeds: [successEmbed("Setup complete", "This server is configured. Enabled features are available immediately; use `/config` or `/moderation config` to make changes.")], components: [] });
  }
}

async function enabledModules(client: BotClient, guildId: string) {
  const enabled = [];
  for (const module of client.platform.modules.all()) if (await client.platform.settings.isModuleEnabled(guildId, module.manifest.id)) enabled.push(module);
  return enabled;
}

async function review(client: BotClient, guild: Guild, actorId: string) {
  return reviewView(client.platform.settings, client.platform.modules, guild.id, actorId, await setupPermissionIssues(guild, client));
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
      if (!channel.permissionsFor(guild.members.me!)?.has(["ViewChannel", "SendMessages", "EmbedLinks"])) throw new Error(`I need View Channel, Send Messages, and Embed Links in ${channel}.`);
    }
  }
}

async function botPermissionIssues(guild: Guild, client: BotClient): Promise<string[]> {
  const me = guild.members.me ?? await guild.members.fetchMe();
  const issues = new Set<string>();
  for (const module of client.modules.all()) if (await client.platform.settings.isModuleEnabled(guild.id, module.manifest.id)) {
    for (const feature of module.manifest.features) if (await client.platform.settings.isFeatureEnabled(guild.id, module.manifest.id, feature.id)) {
      for (const permission of feature.requiredBotPermissions ?? []) if (!me.permissions.has(permission)) issues.add(`${new PermissionsBitField(permission).toArray().join(", ")} — required by ${module.manifest.name} → ${feature.name}`);
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
  if (interaction.isMessageComponent() || (interaction.isModalSubmit() && interaction.isFromMessage())) await interaction.update(payload);
  else await respond(interaction, payload as SafeReplyOptions);
}

function required(values: readonly string[], index: number): string {
  const value = values[index];
  if (!value) throw new Error("This setup control is incomplete or stale.");
  return value;
}

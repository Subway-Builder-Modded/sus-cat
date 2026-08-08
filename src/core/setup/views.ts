import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder } from "discord.js";

import type { GuildConfigService } from "../config/service.js";
import { componentId } from "../interactions/custom-id.js";
import type { ModuleRegistry } from "../modules/registry.js";
import { channelLabel, roleListLabel, statusLabel, ui } from "../ui/theme.js";

export function welcomeView(actorId: string) {
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("Welcome to Server Setup").setDescription("This guided setup stores every choice for this server in PostgreSQL. You will choose modules, features, required channels, and staff roles before reviewing the result.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "setup", "start", actorId)).setLabel("Begin Setup").setStyle(ButtonStyle.Primary))] };
}

export async function moduleSelectionView(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, actorId: string) {
  const modules = registry.all();
  const selected = (await Promise.all(modules.map(async (module) => await settings.isModuleEnabled(guildId, module.manifest.id) ? module.manifest.id : undefined))).filter((id): id is string => Boolean(id));
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("core", "setup", "modules", actorId)).setPlaceholder("Choose modules").setMinValues(0).setMaxValues(modules.length).addOptions(modules.map((module) => ({ label: module.manifest.name, description: module.manifest.description.slice(0, 100), value: module.manifest.id, emoji: module.manifest.icon, default: selected.includes(module.manifest.id) })));
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("Choose Modules").setDescription("Select the modules this server should use. You can change these later with `/config`.")], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] };
}

export async function featureSelectionView(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, moduleId: string, actorId: string) {
  const module = registry.require(moduleId);
  const enabled = (await Promise.all(module.manifest.features.map(async (feature) => await settings.isFeatureEnabled(guildId, moduleId, feature.id) ? feature.id : undefined))).filter((id): id is string => Boolean(id));
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("core", "setup", "features", actorId, moduleId)).setPlaceholder(`Choose ${module.manifest.name} features`).setMinValues(0).setMaxValues(module.manifest.features.length).addOptions(module.manifest.features.map((feature) => ({ label: feature.name, description: feature.description.slice(0, 100), value: feature.id, default: enabled.includes(feature.id) })));
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(`${module.manifest.icon} ${module.manifest.name} Features`).setDescription("Feature dependencies are enforced automatically. After saving, required configuration will be collected.")], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] };
}

export async function setupConfigurationView(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, moduleId: string, actorId: string) {
  const module = registry.require(moduleId);
  const config = await settings.getModuleConfig(guildId, moduleId);
  const definitions = module.manifest.config.filter((item) => item.setup);
  const fields = definitions.map((item) => `**${item.label}** — ${item.type === "channel" ? channelLabel(config[item.key]) : item.type === "role-list" ? roleListLabel(config[item.key]) : String(config[item.key] ?? "Not configured")}`).join("\n");
  const components: ActionRowBuilder<ChannelSelectMenuBuilder | RoleSelectMenuBuilder | ButtonBuilder>[] = [];
  for (const definition of definitions.filter((item) => item.type === "channel").slice(0, 2)) components.push(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId(componentId("core", "setup", "channel", actorId, moduleId, definition.key)).setPlaceholder(definition.label).setChannelTypes(ChannelType.GuildText).setMinValues(1).setMaxValues(1)));
  const roleDefinition = definitions.find((item) => item.type === "role-list");
  if (roleDefinition) components.push(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId(componentId("core", "setup", "roles", actorId, moduleId, roleDefinition.key)).setPlaceholder(roleDefinition.label).setMinValues(0).setMaxValues(10)));
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "setup", "continue", actorId, moduleId)).setLabel("Continue").setStyle(ButtonStyle.Primary)));
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(`${module.manifest.name} Configuration`).setDescription(fields || "This module has no setup fields.")], components };
}

export async function reviewView(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, actorId: string, permissionIssues: readonly string[] = []) {
  const enabledModules = [];
  for (const module of registry.all()) if (await settings.isModuleEnabled(guildId, module.manifest.id)) {
    const features = [];
    for (const feature of module.manifest.features) if (await settings.isFeatureEnabled(guildId, module.manifest.id, feature.id)) features.push(feature.name);
    enabledModules.push(`**${module.manifest.icon} ${module.manifest.name}**\n${features.join(", ") || "No features enabled"}`);
  }
  const issues = await settings.configurationIssues(guildId);
  const allIssues = [...issues.map((issue) => issue.message), ...permissionIssues];
  const description = `${enabledModules.join("\n\n") || "No optional modules selected."}\n\n**Validation**\n${allIssues.length ? allIssues.map((issue) => `${ui.icons.error} ${issue}`).join("\n") : `${ui.icons.success} Required configuration and bot permissions are complete.`}`;
  return { embeds: [new EmbedBuilder().setColor(allIssues.length ? ui.colors.warning : ui.colors.success).setTitle("Setup Review").setDescription(description)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "setup", "back", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(componentId("core", "setup", "finish", actorId)).setLabel("Finish Setup").setStyle(ButtonStyle.Success).setDisabled(allIssues.length > 0))] };
}

export async function moduleSummary(settings: GuildConfigService, registry: ModuleRegistry, guildId: string): Promise<string> {
  const lines = [];
  for (const module of registry.all()) lines.push(`${module.manifest.icon} **${module.manifest.name}** — ${statusLabel(await settings.isModuleEnabled(guildId, module.manifest.id))}`);
  return lines.join("\n");
}

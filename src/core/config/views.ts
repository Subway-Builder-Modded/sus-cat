import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder } from "discord.js";

import type { GuildConfigService } from "./service.js";
import { componentId } from "../interactions/custom-id.js";
import type { ModuleRegistry } from "../modules/registry.js";
import { channelLabel, roleListLabel, statusLabel, ui } from "../ui/theme.js";

export async function configurationHome(settings: GuildConfigService, modules: ModuleRegistry, guildId: string, actorId: string) {
  const rows = [];
  for (const module of modules.all()) rows.push(`${module.manifest.icon} **${module.manifest.name}** — ${statusLabel(await settings.isModuleEnabled(guildId, module.manifest.id))}`);
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("core", "config", "module", actorId)).setPlaceholder("Open a module").addOptions(modules.all().map((module) => ({ label: module.manifest.name, description: module.manifest.description.slice(0, 100), value: module.manifest.id, emoji: module.manifest.icon })));
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("Server Configuration").setDescription(`**Setup:** Complete\n\n${rows.join("\n")}`)], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "audit", actorId)).setLabel("Recent Changes").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(componentId("core", "config", "reset_prompt", actorId)).setLabel("Reset Help").setStyle(ButtonStyle.Secondary))] };
}

export async function moduleConfigurationView(settings: GuildConfigService, modules: ModuleRegistry, guildId: string, moduleId: string, actorId: string) {
  const module = modules.require(moduleId);
  const enabled = await settings.isModuleEnabled(guildId, moduleId);
  if (!enabled) return {
    embeds: [new EmbedBuilder().setColor(ui.colors.neutral).setTitle(`${module.manifest.icon} ${module.manifest.name}`).setDescription("This module is disabled. Enable it to configure its features and settings.")],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(componentId("core", "config", "toggle", actorId, moduleId)).setLabel("Enable Module").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(componentId("core", "config", "home", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary),
    )],
  };
  if (module.configurationView) return module.configurationView(settings, guildId, actorId);
  const config = await settings.getModuleConfig(guildId, moduleId);
  const featureLines = [];
  for (const feature of module.manifest.features) featureLines.push(`${await settings.isFeatureEnabled(guildId, moduleId, feature.id) ? ui.icons.enabled : ui.icons.disabled} ${feature.name}`);
  const definitions = [];
  for (const definition of module.manifest.config) if (await settings.isConfigAvailable(guildId, moduleId, definition.key)) definitions.push(definition);
  const configuration = definitions.map((item) => `**${item.label}:** ${item.type === "channel" || item.type === "category" ? channelLabel(config[item.key]) : item.type === "role-list" ? roleListLabel(config[item.key]) : String(config[item.key] ?? "Not configured")}`).join("\n") || "No settings are available for the enabled features.";
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(`${module.manifest.icon} ${module.manifest.name}`).setDescription(`**Status:** ${statusLabel(enabled)}\n\n**Features**\n${featureLines.join("\n") || "No feature switches."}\n\n**Configuration**\n${configuration}`)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "toggle", actorId, moduleId)).setLabel(enabled ? "Disable Module" : "Enable Module").setStyle(enabled ? ButtonStyle.Danger : ButtonStyle.Success), new ButtonBuilder().setCustomId(componentId("core", "config", "features", actorId, moduleId)).setLabel("Features").setStyle(ButtonStyle.Primary).setDisabled(!module.manifest.features.length), new ButtonBuilder().setCustomId(componentId("core", "config", "settings", actorId, moduleId)).setLabel("Settings").setStyle(ButtonStyle.Primary).setDisabled(!module.manifest.config.length)), new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "home", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(componentId("core", "config", "reset_module_prompt", actorId, moduleId)).setLabel("Reset Module").setStyle(ButtonStyle.Danger))] };
}

export async function featureConfigurationView(settings: GuildConfigService, modules: ModuleRegistry, guildId: string, moduleId: string, actorId: string) {
  const module = modules.require(moduleId);
  const enabled: string[] = [];
  for (const feature of module.manifest.features) if (await settings.isFeatureEnabled(guildId, moduleId, feature.id)) enabled.push(feature.id);
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("core", "config", "save_features", actorId, moduleId)).setPlaceholder("Enabled features").setMinValues(0).setMaxValues(module.manifest.features.length).addOptions(module.manifest.features.map((feature) => ({ label: feature.name, description: feature.description.slice(0, 100), value: feature.id, default: enabled.includes(feature.id) })));
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(`${module.manifest.name} Features`).setDescription("Select every feature that should remain enabled. Dependencies are validated when you save.")], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "module_direct", actorId, moduleId)).setLabel("Back").setStyle(ButtonStyle.Secondary))] };
}

export async function settingsPicker(settings: GuildConfigService, modules: ModuleRegistry, guildId: string, moduleId: string, actorId: string) {
  const module = modules.require(moduleId);
  const definitions = [];
  for (const definition of module.manifest.config) if (await settings.isConfigAvailable(guildId, moduleId, definition.key)) definitions.push(definition);
  const back = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "module_direct", actorId, moduleId)).setLabel("Back").setStyle(ButtonStyle.Secondary));
  if (!definitions.length) return { embeds: [new EmbedBuilder().setColor(ui.colors.neutral).setTitle(`${module.manifest.name} Settings`).setDescription("No settings are available for the currently enabled features.")], components: [back] };
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("core", "config", "field", actorId, moduleId)).setPlaceholder("Choose a setting").addOptions(definitions.map((item) => ({ label: item.label, description: item.description.slice(0, 100), value: item.key })));
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(`${module.manifest.name} Settings`).setDescription("Choose a field. Settings owned by disabled features stay hidden until those features are enabled.")], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), back] };
}

export function fieldEditor(modules: ModuleRegistry, moduleId: string, key: string, actorId: string) {
  const definition = modules.require(moduleId).manifest.config.find((item) => item.key === key);
  if (!definition) throw new Error("Unknown configuration field.");
  const id = componentId("core", "config", "save_field", actorId, moduleId, key);
  if (definition.type === "channel" || definition.type === "category" || definition.type === "channel-list") return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(definition.label).setDescription(definition.description)], components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId(id).setPlaceholder(definition.label).setChannelTypes(definition.type === "category" ? ChannelType.GuildCategory : ChannelType.GuildText).setMinValues(definition.required ? 1 : 0).setMaxValues(definition.type === "channel" || definition.type === "category" ? 1 : 10))] };
  if (definition.type === "role" || definition.type === "role-list") return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(definition.label).setDescription(definition.description)], components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId(id).setPlaceholder(definition.label).setMinValues(definition.required ? 1 : 0).setMaxValues(definition.type === "role" ? 1 : 10))] };
  if (definition.type === "enum" && definition.choices) return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(definition.label).setDescription(definition.description)], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(id).setPlaceholder(definition.label).addOptions(definition.choices.map((choice) => ({ label: choice.name, value: choice.value }))))] };
  if (definition.type === "boolean") return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(definition.label).setDescription(definition.description)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`${id}:true`).setLabel("Enable").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`${id}:false`).setLabel("Disable").setStyle(ButtonStyle.Danger))] };
  return undefined;
}

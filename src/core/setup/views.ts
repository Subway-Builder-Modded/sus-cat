import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, ModalBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, type InteractionUpdateOptions } from "discord.js";

import type { GuildConfigService } from "../config/service.js";
import type { ConfigType, ConfigValue } from "../config/definitions.js";
import { componentId } from "../interactions/custom-id.js";
import type { ModuleRegistry } from "../modules/registry.js";
import { channelLabel, roleListLabel, statusLabel, ui } from "../ui/theme.js";

const progress = (step: string, breadcrumb: string) => `Setup • ${step}\n${breadcrumb}`;

export function welcomeView(actorId: string) {
  return {
    embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("Server Setup").setDescription(`Welcome to the sus cat setup wizard! This guided process will help you configure the bot for your server. You can always return to this wizard later if you need to make changes.\n\n**Setup Steps**\n1. Permissions\n\n2. Toggle Modules\n\n3. Feature Select\n\n4. Configuration`)],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "setup", "start", actorId)).setLabel("Begin Setup").setStyle(ButtonStyle.Primary))],
  };
}

export async function botAdminRolesView(settings: GuildConfigService, guildId: string, actorId: string) {
  const selected = await settings.botAdminRoleIds(guildId);
  return {
    embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("Admin Roles").setDescription(`Admin roles are used to determine who can configure the bot and manage its features. Users with these roles will have access to the bot's configuration commands and settings.\n\n**Current Admin Roles**\n${roleListLabel(selected) || "No roles selected"}\n\nPlease select the roles that should have admin permissions when using the bot. You can select multiple roles, or none if you prefer to manage permissions manually.`)],
    components: [
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId(componentId("core", "setup", "admin_roles", actorId)).setPlaceholder("Choose Admin Roles").setMinValues(0).setMaxValues(10).setDefaultRoles(selected)),
      navigation(actorId, "welcome", "continue_admin"),
    ],
  };
}

export async function moduleSelectionView(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, actorId: string) {
  const modules = registry.all();
  const selected = (await Promise.all(modules.map(async (module) => await settings.isModuleEnabled(guildId, module.manifest.id) ? module.manifest.id : undefined))).filter((id): id is string => Boolean(id));
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("core", "setup", "modules", actorId)).setPlaceholder("Choose modules").setMinValues(0).setMaxValues(modules.length).addOptions(modules.map((module) => ({ label: module.manifest.name, description: module.manifest.description.slice(0, 100), value: module.manifest.id, emoji: module.manifest.icon, default: selected.includes(module.manifest.id) })));
  return {
    embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("Toggle Modules").setDescription(`Choose the modules you want to enable for your server.\n\n**Current Module Status**\n${await moduleSummary(settings, registry, guildId) || "No modules selected."}`)],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), navigation(actorId, "back_admin", "continue_modules")],
  };
}

export async function featureSelectionView(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, moduleId: string, actorId: string) {
  const module = registry.require(moduleId);
  const enabled = (await Promise.all(module.manifest.features.map(async (feature) => await settings.isFeatureEnabled(guildId, moduleId, feature.id) ? feature.id : undefined))).filter((id): id is string => Boolean(id));
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("core", "setup", "features", actorId, moduleId)).setPlaceholder(`Choose ${module.manifest.name} features`).setMinValues(0).setMaxValues(module.manifest.features.length).addOptions(module.manifest.features.map((feature) => ({ label: feature.name, description: feature.description.slice(0, 100), value: feature.id, default: enabled.includes(feature.id) })));
  return {
    embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(`${module.manifest.icon} ${module.manifest.name} Features`).setDescription(`Select the features you want to enable for the ${module.manifest.name} module.\n\n**Current Feature Status**\n${module.manifest.features.map((feature) => `**${feature.name}** — ${statusLabel(enabled.includes(feature.id))}`).join("\n") || "No features selected."}`)],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), navigation(actorId, "back_features", "continue_features", moduleId)],
  };
}

export async function setupConfigurationView(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, moduleId: string, actorId: string) {
  const module = registry.require(moduleId);
  const config = await settings.getModuleConfig(guildId, moduleId);
  const definitions = [];
  for (const definition of module.manifest.config) if (await settings.isConfigAvailable(guildId, moduleId, definition.key)) definitions.push(definition);
  const required = new Set<string>();
  for (const definition of definitions) if (await settings.isConfigRequired(guildId, moduleId, definition.key)) required.add(definition.key);
  const fields = definitions.map((item) => `**${item.label}**${required.has(item.key) ? " *" : ""} — ${formatConfigValue(item.type, config[item.key])}`).join("\n");
  const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];
  if (definitions.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
    .setCustomId(componentId("core", "setup", "config_field", actorId, moduleId))
    .setPlaceholder("Choose a setting to configure")
    .addOptions(definitions.map((definition) => ({ label: `${definition.label}${required.has(definition.key) ? " *" : ""}`.slice(0, 100), description: definition.description.slice(0, 100), value: definition.key })))));
  components.push(navigation(actorId, "back_config", "continue_config", moduleId));
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(`${module.manifest.icon} ${module.manifest.name} Configuration`).setDescription(`${fields || "No settings are available for the enabled features."}${required.size ? "\n\n`*` Required" : ""}`)], components };
}

export async function setupFieldEditor(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, moduleId: string, key: string, actorId: string): Promise<{ view: InteractionUpdateOptions } | { modal: ModalBuilder }> {
  await settings.requireConfigAvailable(guildId, moduleId, key);
  const definition = registry.require(moduleId).manifest.config.find((item) => item.key === key);
  if (!definition) throw new Error("That setup field no longer exists.");
  const config = await settings.getModuleConfig(guildId, moduleId), value = config[key], required = await settings.isConfigRequired(guildId, moduleId, key);
  const title = `${definition.label}${required ? " *" : ""}`;
  const id = (action: string, ...parts: string[]) => componentId("core", "setup", action, actorId, moduleId, key, ...parts);
  const back = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "setup", "config_home", actorId, moduleId)).setLabel("Back to Settings").setStyle(ButtonStyle.Secondary));
  const embed = new EmbedBuilder().setColor(ui.colors.primary).setTitle(title).setDescription(`${definition.description}\n\nCurrent: ${formatConfigValue(definition.type, value)}`);
  if (definition.type === "channel" || definition.type === "category" || definition.type === "channel-list") {
    const menu = new ChannelSelectMenuBuilder().setCustomId(id("config_channel")).setPlaceholder(title).setChannelTypes(definition.type === "category" ? ChannelType.GuildCategory : ChannelType.GuildText).setMinValues(required ? 1 : 0).setMaxValues(definition.type === "channel-list" ? 10 : 1);
    if (typeof value === "string" && value) menu.setDefaultChannels(value); else if (Array.isArray(value) && value.length) menu.setDefaultChannels(value);
    return { view: { embeds: [embed], components: [new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(menu), back] } };
  }
  if (definition.type === "role" || definition.type === "role-list") {
    const menu = new RoleSelectMenuBuilder().setCustomId(id("config_role")).setPlaceholder(title).setMinValues(required ? 1 : 0).setMaxValues(definition.type === "role-list" ? 10 : 1);
    if (typeof value === "string" && value) menu.setDefaultRoles(value); else if (Array.isArray(value) && value.length) menu.setDefaultRoles(value);
    return { view: { embeds: [embed], components: [new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(menu), back] } };
  }
  if (definition.type === "enum" && definition.choices?.length) return { view: { embeds: [embed], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(id("config_value")).setPlaceholder(title).addOptions(definition.choices.map((choice) => ({ label: choice.name, value: choice.value, default: value === choice.value })))), back] } };
  if (definition.type === "boolean") return { view: { embeds: [embed], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(id("config_boolean", "true")).setLabel("Enable").setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(id("config_boolean", "false")).setLabel("Disable").setStyle(ButtonStyle.Danger)), back] } };
  const input = new TextInputBuilder().setCustomId("value").setLabel(title.slice(0, 45)).setStyle(definition.type === "string-list" ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(required).setMaxLength(definition.type === "integer" || definition.type === "duration" ? 20 : 1_000);
  const current = Array.isArray(value) ? value.join("\n") : value === null ? "" : String(value);
  if (current) input.setValue(current.slice(0, 1_000));
  return { modal: new ModalBuilder().setCustomId(id("config_modal")).setTitle(`Configure ${definition.label}`.slice(0, 45)).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input)) };
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
  const description = `${progress("Review", "Review → Finish")}\n\n**Bot Admins**\n${roleListLabel(await settings.botAdminRoleIds(guildId))}\n\n${enabledModules.join("\n\n") || "No optional modules selected."}\n\n**Validation**\n${allIssues.length ? allIssues.map((issue) => `${ui.icons.error} ${issue}`).join("\n") : `${ui.icons.success} Required configuration and bot permissions are complete.`}`;
  return { embeds: [new EmbedBuilder().setColor(allIssues.length ? ui.colors.warning : ui.colors.success).setTitle("Setup Review").setDescription(description)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "setup", "back_review", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary), new ButtonBuilder().setCustomId(componentId("core", "setup", "finish", actorId)).setLabel("Finish Setup").setStyle(ButtonStyle.Success).setDisabled(allIssues.length > 0))] };
}

export async function moduleSummary(settings: GuildConfigService, registry: ModuleRegistry, guildId: string): Promise<string> {
  const lines = [];
  for (const module of registry.all()) lines.push(`${module.manifest.icon} **${module.manifest.name}** — ${statusLabel(await settings.isModuleEnabled(guildId, module.manifest.id))}`);
  return lines.join("\n");
}

function navigation(actorId: string, backAction: string, continueAction: string, moduleId?: string) {
  const parts = moduleId ? [actorId, moduleId] : [actorId];
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("core", "setup", backAction, ...parts)).setLabel("Back").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(componentId("core", "setup", continueAction, ...parts)).setLabel("Continue").setStyle(ButtonStyle.Primary),
  );
}

function formatConfigValue(type: ConfigType, value: ConfigValue | undefined): string {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length)) return "Not configured";
  if (type === "channel" || type === "category") return channelLabel(value);
  if (type === "channel-list" && Array.isArray(value)) return value.map((id) => `<#${id}>`).join(", ");
  if (type === "role" && typeof value === "string") return `<@&${value}>`;
  if (type === "role-list") return roleListLabel(value);
  if (type === "boolean") return value ? "Enabled" : "Disabled";
  return Array.isArray(value) ? value.join(", ") : String(value);
}

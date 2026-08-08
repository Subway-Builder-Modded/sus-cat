import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder, ChannelType, EmbedBuilder, RoleSelectMenuBuilder, StringSelectMenuBuilder } from "discord.js";

import type { GuildConfigService } from "../config/service.js";
import { componentId } from "../interactions/custom-id.js";
import type { ModuleRegistry } from "../modules/registry.js";
import { channelLabel, roleListLabel, statusLabel, ui } from "../ui/theme.js";

const progress = (step: string, breadcrumb: string) => `Setup • ${step}\n${breadcrumb}`;

export function welcomeView(actorId: string) {
  return {
    embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("Welcome to Server Setup").setDescription(`${progress("Welcome", "Start → Permissions → Modules → Review")}\n\nThis wizard configures the bot only for this server. Selections and navigation are separate, so you can keep every default and still continue.`)],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "setup", "start", actorId)).setLabel("Begin Setup").setStyle(ButtonStyle.Primary))],
  };
}

export async function botAdminRolesView(settings: GuildConfigService, guildId: string, actorId: string) {
  const selected = await settings.botAdminRoleIds(guildId);
  return {
    embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("Bot Admin Roles").setDescription(`${progress("Permissions", "Bot Admin Roles")}\n\nBot Admin roles have full access to setup, configuration, modules, and moderation. The server owner and members with Manage Server remain fallback administrators.\n\n**Selected:** ${roleListLabel(selected)}`)],
    components: [
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId(componentId("core", "setup", "admin_roles", actorId)).setPlaceholder("Choose Bot Admin roles").setMinValues(0).setMaxValues(10).setDefaultRoles(selected)),
      navigation(actorId, "welcome", "continue_admin"),
    ],
  };
}

export async function moduleSelectionView(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, actorId: string) {
  const modules = registry.all();
  const selected = (await Promise.all(modules.map(async (module) => await settings.isModuleEnabled(guildId, module.manifest.id) ? module.manifest.id : undefined))).filter((id): id is string => Boolean(id));
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("core", "setup", "modules", actorId)).setPlaceholder("Choose modules").setMinValues(0).setMaxValues(modules.length).addOptions(modules.map((module) => ({ label: module.manifest.name, description: module.manifest.description.slice(0, 100), value: module.manifest.id, emoji: module.manifest.icon, default: selected.includes(module.manifest.id) })));
  return {
    embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("Choose Modules").setDescription(`${progress("Modules", "Modules → Features")}\n\nChoose what this server should use. You may select all, some, or none. Use **Continue** even when the selection already looks right.`)],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), navigation(actorId, "back_admin", "continue_modules")],
  };
}

export async function featureSelectionView(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, moduleId: string, actorId: string) {
  const module = registry.require(moduleId);
  const enabled = (await Promise.all(module.manifest.features.map(async (feature) => await settings.isFeatureEnabled(guildId, moduleId, feature.id) ? feature.id : undefined))).filter((id): id is string => Boolean(id));
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("core", "setup", "features", actorId, moduleId)).setPlaceholder(`Choose ${module.manifest.name} features`).setMinValues(0).setMaxValues(module.manifest.features.length).addOptions(module.manifest.features.map((feature) => ({ label: feature.name, description: feature.description.slice(0, 100), value: feature.id, default: enabled.includes(feature.id) })));
  return {
    embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(`${module.manifest.icon} ${module.manifest.name} Features`).setDescription(`${progress("Features", `${module.manifest.name} → Features`)}\n\nEach feature is independently enabled for this server. Dependencies are applied safely. Changing this menu saves the draft; **Continue** advances.`)],
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), navigation(actorId, "back_features", "continue_features", moduleId)],
  };
}

export async function setupConfigurationView(settings: GuildConfigService, registry: ModuleRegistry, guildId: string, moduleId: string, actorId: string) {
  const module = registry.require(moduleId);
  const config = await settings.getModuleConfig(guildId, moduleId);
  const definitions = module.manifest.config.filter((item) => item.setup);
  const fields = definitions.map((item) => `**${item.label}** — ${item.type === "channel" || item.type === "category" ? channelLabel(config[item.key]) : item.type === "role-list" ? roleListLabel(config[item.key]) : String(config[item.key] ?? "Not configured")}`).join("\n");
  const components: ActionRowBuilder<ChannelSelectMenuBuilder | RoleSelectMenuBuilder | StringSelectMenuBuilder | ButtonBuilder>[] = [];
  for (const definition of definitions.filter((item) => item.type === "channel" || item.type === "category").slice(0, 2)) {
    components.push(new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(new ChannelSelectMenuBuilder().setCustomId(componentId("core", "setup", "channel", actorId, moduleId, definition.key)).setPlaceholder(definition.label).setChannelTypes(definition.type === "category" ? ChannelType.GuildCategory : ChannelType.GuildText).setMinValues(definition.required ? 1 : 0).setMaxValues(1)));
  }
  const roleDefinition = definitions.find((item) => item.type === "role-list");
  if (roleDefinition) {
    const roles = Array.isArray(config[roleDefinition.key]) ? config[roleDefinition.key] as string[] : [];
    components.push(new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(new RoleSelectMenuBuilder().setCustomId(componentId("core", "setup", "roles", actorId, moduleId, roleDefinition.key)).setPlaceholder(roleDefinition.label).setMinValues(roleDefinition.required ? 1 : 0).setMaxValues(10).setDefaultRoles(roles)));
  }
  const enumDefinition = definitions.find((item) => item.type === "enum");
  if (enumDefinition?.choices?.length) {
    components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
      .setCustomId(componentId("core", "setup", "enum", actorId, moduleId, enumDefinition.key))
      .setPlaceholder(enumDefinition.label)
      .addOptions(enumDefinition.choices.map((choice) => ({ label: choice.name, value: choice.value, default: config[enumDefinition.key] === choice.value })))));
  }
  components.push(navigation(actorId, "back_config", "continue_config", moduleId));
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(`${module.manifest.icon} ${module.manifest.name} Configuration`).setDescription(`${progress("Configuration", `${module.manifest.name} → Required Settings`)}\n\n${fields || "No setup fields are required for this module."}`)], components };
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

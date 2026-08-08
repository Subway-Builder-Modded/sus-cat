import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from "discord.js";

import type { GuildConfigService } from "../../../../core/config/service.js";
import { componentId as coreComponentId } from "../../../../core/interactions/custom-id.js";
import { channelLabel, roleListLabel, statusLabel } from "../../../../core/ui/theme.js";
import { moderationManifest } from "../../manifest.js";
import { componentId } from "../../utils/custom-id.js";

export async function moderationConfigView(settings: GuildConfigService, guildId: string, actorId: string) {
  const config = await settings.getModuleConfig(guildId, "moderation"), featureLines = [], enabledFeatures = new Set<string>();
  for (const feature of moderationManifest.features) {
    const enabled = await settings.isFeatureEnabled(guildId, "moderation", feature.id);
    if (enabled) enabledFeatures.add(feature.id);
    featureLines.push(`${enabled ? "✅" : "⬛"} ${feature.name}`);
  }
  const channelLines = [
    enabledFeatures.has("audit-log") ? `Log Channel: ${channelLabel(config.auditLogChannelId)}` : undefined,
    enabledFeatures.has("cases") ? `Case Category: ${channelLabel(config.caseCategoryId)}` : undefined,
  ].filter((line): line is string => Boolean(line));
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("🛡️ Moderation Configuration").addFields(
    { name: "Status", value: statusLabel(await settings.isModuleEnabled(guildId, "moderation")) },
    { name: "Features", value: featureLines.join("\n") },
    { name: "Channels", value: channelLines.join("\n") || "No channel-backed features are enabled." },
    { name: "Roles", value: `Moderators: ${roleListLabel(config.moderatorRoleIds)}` },
  );
  return { embeds: [embed], components: [
    row(button("config_features", actorId, "Features"), button("config_section", actorId, "Channels", "channels", channelLines.length > 0), button("config_section", actorId, "Roles", "roles"), button("config_cases", actorId, "Cases", undefined, enabledFeatures.has("cases"))),
    row(button("config_section", actorId, "Notifications", "notifications", enabledFeatures.has("user-notifications")), button("config_section", actorId, "Audit", "audit", enabledFeatures.has("audit-log")), button("config_section", actorId, "Purge", "purge", enabledFeatures.has("purge")), button("config_advanced", actorId, "Advanced")),
    row(new ButtonBuilder().setCustomId(coreComponentId("core", "config", "home", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary)),
  ] };
}

export async function configSectionView(settings: GuildConfigService, guildId: string, category: string, actorId: string) {
  const definitions = [];
  for (const definition of moderationManifest.config) if (definition.category === category && await settings.isConfigAvailable(guildId, "moderation", definition.key)) definitions.push(definition);
  if (!definitions.length) return { embeds: [new EmbedBuilder().setColor(0x2b2d31).setTitle(`Moderation → ${title(category)}`).setDescription("No settings are available here because the related features are disabled.")], components: [row(button("config_home", actorId, "Back"))] };
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("config_field", actorId)).setPlaceholder("Choose a setting").addOptions(definitions.map((definition) => ({ label: definition.label, description: definition.description.slice(0, 100), value: definition.key })));
  return { embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`Moderation → ${title(category)}`).setDescription("Choose a setting to edit. Changes apply only to this server and are audited.")], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), row(button("config_home", actorId, "Back"))] };
}

export function casesConfigView(actorId: string) {
  return { embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("Moderation → Cases").setDescription("Manage case behavior and guild-specific custom classifications. Historical entries preserve type presentation even after a type is deleted.")], components: [row(button("type_list", actorId, "Custom Types"), button("type_add", actorId, "Add Type"), button("config_home", actorId, "Back"))] };
}

export function advancedConfigView(actorId: string) {
  return { embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle("Moderation → Advanced").setDescription("Use `/case reset` to remove only moderation cases, entries, evidence, custom types, and numbering. Use `/resetsetup` for a transactional full-server bot reset.")], components: [row(button("config_home", actorId, "Back"))] };
}

function button(action: string, actorId: string, label: string, part?: string, enabled = true) { return new ButtonBuilder().setCustomId(componentId(action, actorId, ...(part ? [part] : []))).setLabel(label).setStyle(ButtonStyle.Secondary).setDisabled(!enabled); }
function row(...buttons: ButtonBuilder[]) { return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons); }
function title(value: string): string { return value.slice(0, 1).toUpperCase() + value.slice(1); }

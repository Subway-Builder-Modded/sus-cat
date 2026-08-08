import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder } from "discord.js";

import type { GuildConfigService } from "../../../../core/config/service.js";
import { componentId as coreComponentId } from "../../../../core/interactions/custom-id.js";
import { channelLabel, roleListLabel, statusLabel } from "../../../../core/ui/theme.js";
import { moderationManifest } from "../../manifest.js";
import { componentId } from "../../utils/custom-id.js";

export async function moderationConfigView(settings: GuildConfigService, guildId: string, actorId: string) {
  const config = await settings.getModuleConfig(guildId, "moderation"), featureLines = [];
  for (const feature of moderationManifest.features) featureLines.push(`${await settings.isFeatureEnabled(guildId, "moderation", feature.id) ? "✅" : "⬛"} ${feature.name}`);
  const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("🛡️ Moderation Configuration").addFields(
    { name: "Status", value: statusLabel(await settings.isModuleEnabled(guildId, "moderation")) },
    { name: "Features", value: featureLines.join("\n") },
    { name: "Channels", value: `Moderation Log: ${channelLabel(config.moderationLogChannelId)}\nAudit Log: ${channelLabel(config.auditLogChannelId)}\nCase Category: ${channelLabel(config.caseCategoryId)}` },
    { name: "Roles", value: `Moderators: ${roleListLabel(config.moderatorRoleIds)}` },
  );
  return { embeds: [embed], components: [
    row(button("config_features", actorId, "Features"), button("config_section", actorId, "Channels", "channels"), button("config_section", actorId, "Roles", "roles"), button("config_cases", actorId, "Cases")),
    row(button("config_section", actorId, "Notifications", "notifications"), button("config_section", actorId, "Audit", "audit"), button("config_section", actorId, "Purge", "purge"), button("config_advanced", actorId, "Advanced")),
    row(new ButtonBuilder().setCustomId(coreComponentId("core", "config", "home", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary)),
  ] };
}

export function configSectionView(category: string, actorId: string) {
  const definitions = moderationManifest.config.filter((definition) => definition.category === category);
  const menu = new StringSelectMenuBuilder().setCustomId(componentId("config_field", actorId)).setPlaceholder("Choose a setting").addOptions(definitions.map((definition) => ({ label: definition.label, description: definition.description.slice(0, 100), value: definition.key })));
  return { embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle(`Moderation → ${title(category)}`).setDescription("Choose a setting to edit. Changes apply only to this server and are audited.")], components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu), row(button("config_home", actorId, "Back"))] };
}

export function casesConfigView(actorId: string) {
  return { embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("Moderation → Cases").setDescription("Manage case behavior and guild-specific custom classifications. Historical entries preserve type presentation even after a type is deleted.")], components: [row(button("type_list", actorId, "Custom Types"), button("type_add", actorId, "Add Type"), button("config_home", actorId, "Back"))] };
}

export function advancedConfigView(actorId: string) {
  return { embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle("Moderation → Advanced").setDescription("Use `/case reset` to remove only moderation cases, entries, evidence, custom types, and numbering. Use `/resetsetup` for a transactional full-server bot reset.")], components: [row(button("config_home", actorId, "Back"))] };
}

function button(action: string, actorId: string, label: string, part?: string) { return new ButtonBuilder().setCustomId(componentId(action, actorId, ...(part ? [part] : []))).setLabel(label).setStyle(ButtonStyle.Secondary); }
function row(...buttons: ButtonBuilder[]) { return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons); }
function title(value: string): string { return value.slice(0, 1).toUpperCase() + value.slice(1); }

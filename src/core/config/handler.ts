import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, type InteractionUpdateOptions } from "discord.js";

import type { BotClient } from "../bot/bot-client.js";
import { componentId } from "../interactions/custom-id.js";
import { respond, type SafeReplyOptions } from "../interactions/response.js";
import type { RoutedComponentInteraction } from "../interactions/types.js";
import { requireConfigurationAccess } from "../permissions/configuration.js";
import { successEmbed, warningEmbed } from "../ui/embeds.js";
import { configurationHome, featureConfigurationView, fieldEditor, moduleConfigurationView, settingsPicker } from "./views.js";

export async function handleConfigComponent(client: BotClient, interaction: RoutedComponentInteraction, action: string, parts: readonly string[]): Promise<void> {
  if (!interaction.inCachedGuild()) throw new Error("Configuration is only available in a server.");
  await requireConfigurationAccess(client.platform.settings, interaction.member);
  const actorId = required(parts, 0);
  if (actorId !== interaction.user.id) throw new Error("This configuration panel belongs to another administrator.");
  const { settings, modules } = client.platform;

  if (action === "home") return update(interaction, await configurationHome(settings, modules, interaction.guildId, actorId));
  if ((action === "module" && interaction.isStringSelectMenu()) || action === "module_direct") {
    const moduleId = action === "module" && interaction.isStringSelectMenu() ? required(interaction.values, 0) : required(parts, 1);
    return update(interaction, await moduleConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "toggle" && interaction.isButton()) {
    const moduleId = required(parts, 1);
    await settings.setModuleEnabled(interaction.guildId, moduleId, !await settings.isModuleEnabled(interaction.guildId, moduleId), actorId);
    return update(interaction, await moduleConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "features") {
    const moduleId = required(parts, 1);
    if (!await settings.isModuleEnabled(interaction.guildId, moduleId)) throw new Error("Enable this module before configuring its features.");
    return update(interaction, await featureConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "save_features" && interaction.isStringSelectMenu()) {
    const moduleId = required(parts, 1);
    if (!await settings.isModuleEnabled(interaction.guildId, moduleId)) throw new Error("Enable this module before configuring its features.");
    const manifest = modules.require(moduleId).manifest;
    for (const feature of [...manifest.features].reverse()) if (!interaction.values.includes(feature.id)) await settings.setFeatureEnabled(interaction.guildId, moduleId, feature.id, false, actorId);
    for (const feature of manifest.features) if (interaction.values.includes(feature.id)) await settings.setFeatureEnabled(interaction.guildId, moduleId, feature.id, true, actorId);
    return update(interaction, await moduleConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "settings") return update(interaction, await settingsPicker(settings, modules, interaction.guildId, required(parts, 1), actorId));
  if (action === "field" && interaction.isStringSelectMenu()) {
    const moduleId = required(parts, 1);
    const key = required(interaction.values, 0);
    await settings.requireConfigAvailable(interaction.guildId, moduleId, key);
    const editor = fieldEditor(modules, moduleId, key, actorId);
    if (editor) return update(interaction, editor);
    const definition = modules.require(moduleId).manifest.config.find((item) => item.key === key)!;
    const modal = new ModalBuilder().setCustomId(componentId("core", "config", "modal_field", actorId, moduleId, key)).setTitle(definition.label.slice(0, 45)).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("value").setLabel(definition.label.slice(0, 45)).setStyle(definition.type === "string-list" ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(Boolean(definition.required)).setMaxLength(1_000)));
    if (!interaction.isStringSelectMenu()) return;
    await interaction.showModal(modal);
    return;
  }
  if (action === "save_field") {
    const moduleId = required(parts, 1), key = required(parts, 2);
    await settings.requireConfigAvailable(interaction.guildId, moduleId, key);
    const definition = modules.require(moduleId).manifest.config.find((item) => item.key === key)!;
    let value: unknown;
    if (interaction.isButton()) value = required(parts, 3) === "true";
    else if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu() || interaction.isStringSelectMenu()) value = definition.type.endsWith("-list") ? interaction.values : interaction.values[0] ?? null;
    else return;
    await settings.setConfig(interaction.guildId, moduleId, key, value, actorId);
    return update(interaction, await moduleConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "modal_field" && interaction.isModalSubmit()) {
    const moduleId = required(parts, 1), key = required(parts, 2);
    await settings.requireConfigAvailable(interaction.guildId, moduleId, key);
    const definition = modules.require(moduleId).manifest.config.find((item) => item.key === key)!;
    const raw = interaction.fields.getTextInputValue("value");
    const value = definition.type === "integer" || definition.type === "duration" ? Number(raw) : definition.type === "string-list" ? raw.split(/[,\n]/).map((item) => item.trim()).filter(Boolean) : raw;
    await settings.setConfig(interaction.guildId, moduleId, key, value, actorId);
    await respond(interaction, { embeds: [successEmbed("Configuration saved", `${definition.label} was updated.`)] });
    return;
  }
  if (action === "audit") {
    const events = await settings.repository.recentAudit(interaction.guildId);
    const body = events.map((event) => `<t:${Math.floor(event.createdAt.getTime() / 1_000)}:R> <@${event.actorId}> • **${event.moduleId}** • ${event.featureId ? `${event.featureId} • ` : ""}${event.key}`).join("\n") || "No configuration changes have been recorded.";
    return update(interaction, { embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("Recent Configuration Changes").setDescription(body)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "home", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary))] });
  }
  if (action === "reset_prompt") return update(interaction, { embeds: [warningEmbed("Reset options", "Use `/case reset` to reset moderation history only. Use `/resetsetup` for the transactional nuclear reset of setup, configuration, and module-owned guild data. Both require strong confirmation.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "home", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary))] });
  if (action === "reset_module_prompt") {
    const moduleId = required(parts, 1), module = modules.require(moduleId);
    return update(interaction, { embeds: [warningEmbed(`Reset ${module.manifest.name}?`, "Its switches and settings will return to manifest defaults. Historical module records are preserved.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "reset_module_confirm", actorId, moduleId)).setLabel("Reset Module").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(componentId("core", "config", "module_direct", actorId, moduleId)).setLabel("Cancel").setStyle(ButtonStyle.Secondary))] });
  }
  if (action === "reset_module_confirm") {
    const moduleId = required(parts, 1);
    await settings.resetModule(interaction.guildId, moduleId, actorId);
    return update(interaction, await moduleConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
}

async function update(interaction: RoutedComponentInteraction, payload: InteractionUpdateOptions): Promise<void> {
  if (interaction.isMessageComponent()) await interaction.update(payload);
  else await respond(interaction, payload as SafeReplyOptions);
}

function required(values: readonly string[], index: number): string {
  const value = values[index];
  if (!value) throw new Error("This configuration control is incomplete or stale.");
  return value;
}

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

import type { BotClient } from "../bot/bot-client.js";
import { componentId, requireComponentValue } from "../interactions/custom-id.js";
import { respond, updateComponent, type SafeReplyOptions } from "../interactions/response.js";
import type { RoutedComponentInteraction } from "../interactions/types.js";
import { requireConfigurationAccess } from "../permissions/configuration.js";
import { successEmbed, warningEmbed } from "../ui/embeds.js";
import { configurationHome, featureConfigurationView, fieldEditor, moduleConfigurationView, settingsPicker } from "./views.js";

export async function handleConfigComponent(client: BotClient, interaction: RoutedComponentInteraction, action: string, parts: readonly string[]): Promise<void> {
  if (!interaction.inCachedGuild()) throw new Error("Configuration is only available in a server.");
  await requireConfigurationAccess(client.platform.settings, interaction.member);
  const actorId = requireComponentValue(parts, 0);
  if (actorId !== interaction.user.id) throw new Error("This configuration panel belongs to another administrator.");
  const { settings, modules } = client.platform;

  if (action === "home") return update(interaction, await configurationHome(settings, modules, interaction.guildId, actorId));
  if ((action === "module" && interaction.isStringSelectMenu()) || action === "module_direct") {
    const moduleId = action === "module" && interaction.isStringSelectMenu() ? requireComponentValue(interaction.values, 0) : requireComponentValue(parts, 1);
    return update(interaction, await moduleConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "toggle" && interaction.isButton()) {
    const moduleId = requireComponentValue(parts, 1);
    await settings.setModuleEnabled(interaction.guildId, moduleId, !await settings.isModuleEnabled(interaction.guildId, moduleId), actorId);
    return update(interaction, await moduleConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "features") {
    const moduleId = requireComponentValue(parts, 1);
    if (!await settings.isModuleEnabled(interaction.guildId, moduleId)) throw new Error("Enable this module before configuring its features.");
    return update(interaction, await featureConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "save_features" && interaction.isStringSelectMenu()) {
    const moduleId = requireComponentValue(parts, 1);
    if (!await settings.isModuleEnabled(interaction.guildId, moduleId)) throw new Error("Enable this module before configuring its features.");
    await settings.setEnabledFeatures(interaction.guildId, moduleId, interaction.values, actorId);
    return update(interaction, await moduleConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "settings") return update(interaction, await settingsPicker(settings, modules, interaction.guildId, requireComponentValue(parts, 1), actorId));
  if (action === "field" && interaction.isStringSelectMenu()) {
    const moduleId = requireComponentValue(parts, 1);
    const key = requireComponentValue(interaction.values, 0);
    await settings.requireConfigAvailable(interaction.guildId, moduleId, key);
    const editor = fieldEditor(modules, moduleId, key, actorId);
    if (editor) return update(interaction, editor);
    const definition = requireDefinition(modules, moduleId, key);
    const modal = new ModalBuilder().setCustomId(componentId("core", "config", "modal_field", actorId, moduleId, key)).setTitle(definition.label.slice(0, 45)).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("value").setLabel(definition.label.slice(0, 45)).setStyle(definition.type === "string-list" ? TextInputStyle.Paragraph : TextInputStyle.Short).setRequired(Boolean(definition.required)).setMaxLength(1_000)));
    if (!interaction.isStringSelectMenu()) return;
    await interaction.showModal(modal);
    return;
  }
  if (action === "save_field") {
    const moduleId = requireComponentValue(parts, 1), key = requireComponentValue(parts, 2);
    await settings.requireConfigAvailable(interaction.guildId, moduleId, key);
    const definition = requireDefinition(modules, moduleId, key);
    let value: unknown;
    if (interaction.isButton()) value = requireComponentValue(parts, 3) === "true";
    else if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu() || interaction.isStringSelectMenu()) value = definition.type.endsWith("-list") ? interaction.values : interaction.values[0] ?? null;
    else return;
    await settings.setConfig(interaction.guildId, moduleId, key, value, actorId);
    return update(interaction, await moduleConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
  if (action === "modal_field" && interaction.isModalSubmit()) {
    const moduleId = requireComponentValue(parts, 1), key = requireComponentValue(parts, 2);
    await settings.requireConfigAvailable(interaction.guildId, moduleId, key);
    const definition = requireDefinition(modules, moduleId, key);
    const raw = interaction.fields.getTextInputValue("value");
    const value = definition.type === "integer" || definition.type === "duration" ? Number(raw) : definition.type === "string-list" ? raw.split(/[,\n]/).map((item) => item.trim()).filter(Boolean) : raw;
    await settings.setConfig(interaction.guildId, moduleId, key, value, actorId);
    await respond(interaction, { embeds: [successEmbed("Configuration saved", `${definition.label} was updated.`)] });
    return;
  }
  if (action === "audit") {
    const events = await settings.recentAudit(interaction.guildId);
    const body = events.map((event) => `<t:${Math.floor(event.createdAt.getTime() / 1_000)}:R> <@${event.actorId}> • **${event.moduleId}** • ${event.featureId ? `${event.featureId} • ` : ""}${event.key}`).join("\n") || "No configuration changes have been recorded.";
    return update(interaction, { embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("Recent Configuration Changes").setDescription(body)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "home", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary))] });
  }
  if (action === "reset_prompt") return update(interaction, { embeds: [warningEmbed("Reset options", "Use a module's scoped reset command when you only need to clear that module's data. Use `/resetsetup` for the transactional full reset of setup, configuration, and all module-owned guild data.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "home", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary))] });
  if (action === "reset_module_prompt") {
    const moduleId = requireComponentValue(parts, 1), module = modules.require(moduleId);
    return update(interaction, { embeds: [warningEmbed(`Reset ${module.manifest.name}?`, "Its switches and settings will return to manifest defaults. Historical module records are preserved.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("core", "config", "reset_module_confirm", actorId, moduleId)).setLabel("Reset Module").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(componentId("core", "config", "module_direct", actorId, moduleId)).setLabel("Cancel").setStyle(ButtonStyle.Secondary))] });
  }
  if (action === "reset_module_confirm") {
    const moduleId = requireComponentValue(parts, 1);
    await settings.resetModule(interaction.guildId, moduleId, actorId);
    return update(interaction, await moduleConfigurationView(settings, modules, interaction.guildId, moduleId, actorId));
  }
}

function requireDefinition(modules: import("../modules/registry.js").ModuleRegistry, moduleId: string, key: string) {
  const definition = modules.require(moduleId).manifest.config.find((item) => item.key === key);
  if (!definition) throw new Error("That configuration field no longer exists.");
  return definition;
}

async function update(interaction: RoutedComponentInteraction, payload: SafeReplyOptions): Promise<void> {
  if (interaction.isMessageComponent()) await updateComponent(interaction, payload);
  else await respond(interaction, payload);
}

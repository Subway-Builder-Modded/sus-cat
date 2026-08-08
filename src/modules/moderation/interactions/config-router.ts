import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, type ButtonInteraction, type ModalSubmitInteraction, type StringSelectMenuInteraction } from "discord.js";

import type { BotClient } from "../../../core/bot/bot-client.js";
import { featureConfigurationView, fieldEditor } from "../../../core/config/views.js";
import { requireConfigurationAccess } from "../../../core/permissions/configuration.js";
import { warningEmbed } from "../../../core/ui/embeds.js";
import { requireModerationModule } from "../moderation-module.js";
import { advancedConfigView, casesConfigView, configSectionView, moderationConfigView } from "../ui/config/dashboard.js";
import { successEmbed } from "../ui/responses.js";
import { componentId } from "../utils/custom-id.js";
import { parseHexColor, validateEmoji } from "../utils/custom-type.js";

export async function handleConfigButton(client: BotClient, interaction: ButtonInteraction<"cached">, action: string, parts: readonly string[]): Promise<boolean> {
  if (!action.startsWith("config_") && !action.startsWith("type_")) return false;
  await requireConfigurationAccess(client.platform.settings, interaction.member);
  if (!await client.platform.settings.isModuleEnabled(interaction.guildId, "moderation")) throw new Error("Enable Moderation before configuring its features and settings.");
  const module = requireModerationModule(client);
  if ((action === "config_cases" || action.startsWith("type_")) && !await client.platform.settings.isFeatureEnabled(interaction.guildId, "moderation", "cases")) throw new Error("Enable Cases before configuring custom case types.");
  if (action === "config_home") await interaction.update(await moderationConfigView(client.platform.settings, interaction.guildId, interaction.user.id));
  else if (action === "config_features") await interaction.update(await featureConfigurationView(client.platform.settings, client.platform.modules, interaction.guildId, "moderation", interaction.user.id));
  else if (action === "config_section") await interaction.update(await configSectionView(client.platform.settings, interaction.guildId, required(parts, 1), interaction.user.id));
  else if (action === "config_cases") await interaction.update(casesConfigView(interaction.user.id));
  else if (action === "config_advanced") await interaction.update(advancedConfigView(interaction.user.id));
  else if (action === "type_add") await interaction.showModal(customTypeModal("modal_type_add", interaction.user.id, "new", "Add Custom Type"));
  else if (action === "type_list") {
    const types = await module.cases.listCustomTypes(interaction.guildId);
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("Moderation → Cases → Custom Types").setDescription(types.map((type) => `${type.emoji} **${type.name}** • \`#${type.color.toString(16).padStart(6, "0").toUpperCase()}\``).join("\n") || "No custom types have been created.");
    const components = [];
    if (types.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(componentId("type_select", interaction.user.id)).setPlaceholder("Choose a custom type").addOptions(types.slice(0, 25).map((type) => ({ label: type.name, value: type.id, emoji: type.emoji })))));
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("type_add", interaction.user.id)).setLabel("Add Type").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(componentId("config_cases", interaction.user.id)).setLabel("Back").setStyle(ButtonStyle.Secondary)));
    await interaction.update({ embeds: [embed], components });
  } else if (action === "type_edit") {
    const type = await module.cases.resolveCustomType(interaction.guildId, required(parts, 1)); if (!type) throw new Error("That custom type no longer exists.");
    await interaction.showModal(customTypeModal("modal_type_edit", interaction.user.id, type.id, "Edit Custom Type", type.name, await module.cases.customTypeAliases(interaction.guildId, type.id), `#${type.color.toString(16).padStart(6, "0")}`, type.emoji));
  } else if (action === "type_delete") {
    await interaction.update({ embeds: [warningEmbed("Delete custom type?", "Historical entries keep a snapshot of its presentation. The type will no longer appear in autocomplete.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("type_delete_confirm", interaction.user.id, required(parts, 1))).setLabel("Delete Type").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(componentId("type_list", interaction.user.id)).setLabel("Cancel").setStyle(ButtonStyle.Secondary))] });
  } else if (action === "type_delete_confirm") {
    await module.cases.deleteCustomType(interaction.guildId, required(parts, 1), interaction.user.id);
    await interaction.update({ embeds: [successEmbed("Custom type deleted", "Historical entries remain readable.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("type_list", interaction.user.id)).setLabel("Back to Types").setStyle(ButtonStyle.Secondary))] });
  } else return false;
  return true;
}

export async function handleConfigSelect(client: BotClient, interaction: StringSelectMenuInteraction<"cached">, action: string): Promise<boolean> {
  if (action !== "config_field" && action !== "type_select") return false;
  await requireConfigurationAccess(client.platform.settings, interaction.member);
  if (!await client.platform.settings.isModuleEnabled(interaction.guildId, "moderation")) throw new Error("Enable Moderation before configuring its features and settings.");
  if (action === "config_field") {
    const key = required(interaction.values, 0), editor = fieldEditor(client.platform.modules, "moderation", key, interaction.user.id);
    await client.platform.settings.requireConfigAvailable(interaction.guildId, "moderation", key);
    if (editor) await interaction.update(editor);
    else {
      const definition = client.platform.modules.require("moderation").manifest.config.find((item) => item.key === key); if (!definition) throw new Error("That setting no longer exists.");
      await interaction.showModal(new ModalBuilder().setCustomId(componentId("modal_config_field", interaction.user.id, key)).setTitle(definition.label.slice(0, 45)).addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("value").setLabel(definition.label.slice(0, 45)).setStyle(TextInputStyle.Short).setRequired(Boolean(definition.required)).setMaxLength(1000))));
    }
  } else {
    const module = requireModerationModule(client), type = await module.cases.resolveCustomType(interaction.guildId, required(interaction.values, 0)); if (!type) throw new Error("That custom type no longer exists.");
    const aliases = await module.cases.customTypeAliases(interaction.guildId, type.id);
    await interaction.update({ embeds: [new EmbedBuilder().setColor(type.color).setTitle(`${type.emoji} ${type.name}`).addFields({ name: "Aliases", value: aliases.join(", ") || "None" }, { name: "Color", value: `#${type.color.toString(16).padStart(6, "0").toUpperCase()}` })], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("type_edit", interaction.user.id, type.id)).setLabel("Edit").setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(componentId("type_delete", interaction.user.id, type.id)).setLabel("Delete").setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(componentId("type_list", interaction.user.id)).setLabel("Back").setStyle(ButtonStyle.Secondary))] });
  }
  return true;
}

export async function handleConfigModal(client: BotClient, interaction: ModalSubmitInteraction<"cached">, action: string, parts: readonly string[]): Promise<boolean> {
  if (action !== "modal_config_field" && action !== "modal_type_add" && action !== "modal_type_edit") return false;
  await requireConfigurationAccess(client.platform.settings, interaction.member);
  if (!await client.platform.settings.isModuleEnabled(interaction.guildId, "moderation")) throw new Error("Enable Moderation before configuring its features and settings.");
  if (action === "modal_config_field") {
    const key = required(parts, 1), definition = client.platform.modules.require("moderation").manifest.config.find((item) => item.key === key); if (!definition) throw new Error("That setting no longer exists.");
    await client.platform.settings.requireConfigAvailable(interaction.guildId, "moderation", key);
    const raw = interaction.fields.getTextInputValue("value");
    await client.platform.settings.setConfig(interaction.guildId, "moderation", key, definition.type === "integer" ? Number(raw) : raw, interaction.user.id);
    await interaction.reply({ flags: MessageFlags.Ephemeral, embeds: [successEmbed("Configuration saved", `${definition.label} was updated.`)] });
  } else {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const module = requireModerationModule(client), name = interaction.fields.getTextInputValue("name").trim(), aliases = interaction.fields.getTextInputValue("aliases").split(/[\n,]/).map((value) => value.trim()).filter(Boolean), color = parseHexColor(interaction.fields.getTextInputValue("color")), emoji = validateEmoji(interaction.fields.getTextInputValue("emoji"));
    const type = action === "modal_type_add" ? await module.cases.createCustomType(interaction.guildId, interaction.user.id, { name, aliases, color, emoji }) : await module.cases.updateCustomType(interaction.guildId, required(parts, 1), interaction.user.id, { name, aliases, color, emoji });
    await interaction.editReply({ embeds: [successEmbed(action === "modal_type_add" ? "Custom type created" : "Custom type updated", `${type.emoji} **${type.name}** is available through autocomplete.`)] });
  }
  return true;
}

function customTypeModal(action: string, actorId: string, typeId: string, title: string, name = "", aliases: string[] = [], color = "#5865F2", emoji = "🏷️"): ModalBuilder {
  const fields = [new TextInputBuilder().setCustomId("name").setLabel("Name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80).setValue(name), new TextInputBuilder().setCustomId("aliases").setLabel("Aliases (comma or line separated)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500).setValue(aliases.join(", ")), new TextInputBuilder().setCustomId("color").setLabel("Hex color (#RRGGBB)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7).setValue(color.toUpperCase()), new TextInputBuilder().setCustomId("emoji").setLabel("Unicode or custom Discord emoji").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setValue(emoji)];
  return new ModalBuilder().setCustomId(componentId(action, actorId, typeId)).setTitle(title).addComponents(...fields.map((field) => new ActionRowBuilder<TextInputBuilder>().addComponents(field)));
}
function required(parts: readonly string[], index: number): string { const value = parts[index]; if (!value) throw new Error("This control is incomplete or stale."); return value; }

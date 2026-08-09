import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, StringSelectMenuBuilder, TextInputBuilder, TextInputStyle, type ButtonInteraction, type ModalSubmitInteraction, type StringSelectMenuInteraction } from "discord.js";

import type { BotClient } from "../../../core/bot/bot-client.js";
import { moduleConfigurationTitle } from "../../../core/config/views.js";
import { requireComponentValue } from "../../../core/interactions/custom-id.js";
import { respond, updateComponent } from "../../../core/interactions/response.js";
import { requireConfigurationAccess } from "../../../core/permissions/configuration.js";
import { requireModerationModule } from "../moderation-module.js";
import { moderationManifest } from "../manifest.js";
import { customTypesConfigView } from "../ui/config/custom-types.js";
import { componentId } from "../utils/custom-id.js";
import { parseHexColor, validateEmoji } from "../utils/custom-type.js";

const customTypesTitle = (...pages: readonly string[]) => moduleConfigurationTitle(moderationManifest, "Settings", "Custom Case Types", ...pages);

export async function handleConfigButton(client: BotClient, interaction: ButtonInteraction<"cached">, action: string, parts: readonly string[]): Promise<boolean> {
  if (!action.startsWith("type_")) return false;
  await requireCustomTypeConfigurationAccess(client, interaction);
  const module = requireModerationModule(client);

  if (action === "type_config") {
    await updateComponent(interaction, customTypesConfigView(interaction.user.id));
  } else if (action === "type_add") {
    await interaction.showModal(customTypeModal("modal_type_add", interaction.user.id, "new", "Add Custom Type"));
  } else if (action === "type_list") {
    const types = await module.caseTypes.list(interaction.guildId);
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(customTypesTitle("List")).setDescription(types.map((type) => `${type.emoji} **${type.name}** • \`#${type.color.toString(16).padStart(6, "0").toUpperCase()}\``).join("\n") || "No custom types have been created.");
    const components = [];
    if (types.length) components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(componentId("type_select", interaction.user.id))
        .setPlaceholder("Choose a custom type")
        .addOptions(types.slice(0, 25).map((type) => ({ label: type.name, value: type.id, emoji: type.emoji }))),
    ));
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(componentId("type_add", interaction.user.id)).setLabel("Add Type").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(componentId("type_config", interaction.user.id)).setLabel("Back").setStyle(ButtonStyle.Secondary),
    ));
    await updateComponent(interaction, { embeds: [embed], components });
  } else if (action === "type_edit") {
    const type = await module.caseTypes.resolve(interaction.guildId, requireComponentValue(parts, 1));
    if (!type) throw new Error("That custom type no longer exists.");
    await interaction.showModal(customTypeModal("modal_type_edit", interaction.user.id, type.id, "Edit Custom Type", type.name, await module.caseTypes.aliases(interaction.guildId, type.id), `#${type.color.toString(16).padStart(6, "0")}`, type.emoji));
  } else if (action === "type_delete") {
    const typeId = requireComponentValue(parts, 1);
    await updateComponent(interaction, { embeds: [new EmbedBuilder().setColor(0xfee75c).setTitle(customTypesTitle("Delete")).setDescription("Historical entries keep a snapshot of its presentation. The type will no longer appear in autocomplete.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(componentId("type_delete_confirm", interaction.user.id, typeId)).setLabel("Delete Type").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(componentId("type_list", interaction.user.id)).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    )] });
  } else if (action === "type_delete_confirm") {
    await module.caseTypes.delete(interaction.guildId, requireComponentValue(parts, 1), interaction.user.id);
    await updateComponent(interaction, { embeds: [new EmbedBuilder().setColor(0x57f287).setTitle(customTypesTitle("Deleted")).setDescription("Historical entries remain readable.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("type_list", interaction.user.id)).setLabel("Back to Types").setStyle(ButtonStyle.Secondary))] });
  } else {
    return false;
  }
  return true;
}

export async function handleConfigSelect(client: BotClient, interaction: StringSelectMenuInteraction<"cached">, action: string): Promise<boolean> {
  if (action !== "type_select") return false;
  await requireCustomTypeConfigurationAccess(client, interaction);
  const module = requireModerationModule(client);
  const type = await module.caseTypes.resolve(interaction.guildId, requireComponentValue(interaction.values, 0));
  if (!type) throw new Error("That custom type no longer exists.");
  const aliases = await module.caseTypes.aliases(interaction.guildId, type.id);
  await updateComponent(interaction, { embeds: [new EmbedBuilder().setColor(type.color).setTitle(customTypesTitle(type.name)).addFields(
    { name: "Aliases", value: aliases.join(", ") || "None" },
    { name: "Color", value: `#${type.color.toString(16).padStart(6, "0").toUpperCase()}` },
  )], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("type_edit", interaction.user.id, type.id)).setLabel("Edit").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(componentId("type_delete", interaction.user.id, type.id)).setLabel("Delete").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(componentId("type_list", interaction.user.id)).setLabel("Back").setStyle(ButtonStyle.Secondary),
  )] });
  return true;
}

export async function handleConfigModal(client: BotClient, interaction: ModalSubmitInteraction<"cached">, action: string, parts: readonly string[]): Promise<boolean> {
  if (action !== "modal_type_add" && action !== "modal_type_edit") return false;
  await requireCustomTypeConfigurationAccess(client, interaction);
  const module = requireModerationModule(client);
  const name = interaction.fields.getTextInputValue("name").trim();
  const aliases = interaction.fields.getTextInputValue("aliases").split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
  const color = parseHexColor(interaction.fields.getTextInputValue("color"));
  const emoji = validateEmoji(interaction.fields.getTextInputValue("emoji"));
  const type = action === "modal_type_add"
    ? await module.caseTypes.create(interaction.guildId, interaction.user.id, { name, aliases, color, emoji })
    : await module.caseTypes.update(interaction.guildId, requireComponentValue(parts, 1), interaction.user.id, { name, aliases, color, emoji });
  await respond(interaction, { embeds: [new EmbedBuilder().setColor(0x57f287).setTitle(customTypesTitle(type.name)).setDescription(action === "modal_type_add" ? "The custom type was created." : "The custom type was updated.")] });
  return true;
}

async function requireCustomTypeConfigurationAccess(client: BotClient, interaction: ButtonInteraction<"cached"> | StringSelectMenuInteraction<"cached"> | ModalSubmitInteraction<"cached">): Promise<void> {
  await requireConfigurationAccess(client.platform.settings, interaction.member);
  if (!await client.platform.settings.isModuleEnabled(interaction.guildId, "moderation")) throw new Error("Enable Moderation before configuring its settings.");
  if (!await client.platform.settings.isFeatureEnabled(interaction.guildId, "moderation", "cases")) throw new Error("Enable Cases before configuring custom case types.");
}

function customTypeModal(action: string, actorId: string, typeId: string, title: string, name = "", aliases: string[] = [], color = "#5865F2", emoji = "🏷️"): ModalBuilder {
  const fields = [
    new TextInputBuilder().setCustomId("name").setLabel("Name").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(80).setValue(name),
    new TextInputBuilder().setCustomId("aliases").setLabel("Aliases (comma or line separated)").setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(500).setValue(aliases.join(", ")),
    new TextInputBuilder().setCustomId("color").setLabel("Hex color (#RRGGBB)").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(7).setValue(color.toUpperCase()),
    new TextInputBuilder().setCustomId("emoji").setLabel("Unicode or custom Discord emoji").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100).setValue(emoji),
  ];
  return new ModalBuilder().setCustomId(componentId(action, actorId, typeId)).setTitle(title).addComponents(...fields.map((field) => new ActionRowBuilder<TextInputBuilder>().addComponents(field)));
}

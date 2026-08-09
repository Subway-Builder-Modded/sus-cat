import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";

import type { BotClient } from "../../../core/bot/bot-client.js";
import { componentId } from "../../../core/interactions/custom-id.js";
import { respond, updateComponent } from "../../../core/interactions/response.js";
import type { RoutedComponentInteraction } from "../../../core/interactions/types.js";
import { canConfigure } from "../../../core/permissions/configuration.js";
import { buildDocumentationIndex, searchDocumentation } from "../services/indexer.js";
import { commandList, documentationHome, documentList } from "../ui/views.js";

export async function handleDocumentationComponent(client: BotClient, interaction: RoutedComponentInteraction, action: string, parts: readonly string[]): Promise<void> {
  const actorId = parts[0];
  if (!actorId || actorId !== interaction.user.id) throw new Error("This documentation panel belongs to another user.");
  const index = buildDocumentationIndex(client.platform.modules.all());
  const enabledModuleIds = await enabledModules(client, interaction.guildId);
  if (action === "search" && interaction.isButton()) {
    const modal = new ModalBuilder().setCustomId(componentId("module", "documentation", "search_submit", actorId)).setTitle("Search Documentation").addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId("query").setLabel("What do you need help with?").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)));
    await interaction.showModal(modal);
    return;
  }
  if (action === "search_submit" && interaction.isModalSubmit()) {
    const query = interaction.fields.getTextInputValue("query");
    await respond(interaction, documentList(`Search: ${query}`, searchDocumentation(index, query), actorId));
    return;
  }
  if (!interaction.isMessageComponent()) return;
  if (action === "home") await updateComponent(interaction, documentationHome(client.platform.modules, actorId, enabledModuleIds));
  else if (action === "commands") await updateComponent(interaction, commandList(client.platform.modules, actorId));
  else if (action === "modules") await updateComponent(interaction, documentList("Enabled Modules", index.filter((page) => page.id === "module" && enabledModuleIds.includes(page.moduleId)), actorId));
  else if (action === "modules_all") {
    if (!interaction.inCachedGuild() || !canConfigure(interaction.member)) throw new Error("Only server administrators can browse disabled modules.");
    await updateComponent(interaction, documentList("All Available Modules", index.filter((page) => page.id === "module"), actorId));
  }
  else if (action === "category") await updateComponent(interaction, documentList(parts[1]?.replaceAll("_", " ") ?? "Documentation", index.filter((page) => page.category === parts[1]?.replaceAll("_", " ")), actorId));
}

async function enabledModules(client: BotClient, guildId: string | null): Promise<string[]> {
  if (!guildId) return client.modules.all().map((module) => module.manifest.id);
  const enabled = [];
  for (const module of client.modules.all()) if (await client.platform.settings.isModuleEnabled(guildId, module.manifest.id)) enabled.push(module.manifest.id);
  return enabled;
}

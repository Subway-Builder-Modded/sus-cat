import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

import { componentId } from "../../../core/interactions/custom-id.js";
import type { ModuleRegistry } from "../../../core/modules/registry.js";
import { ui } from "../../../core/ui/theme.js";
import type { IndexedDocument } from "../services/indexer.js";

export function documentationHome(registry: ModuleRegistry, actorId: string, enabledModuleIds?: readonly string[]) {
  const visible = enabledModuleIds ? registry.manifests().filter((module) => enabledModuleIds.includes(module.id)) : registry.manifests();
  const modules = visible.map((module) => `${module.icon} **${module.name}** - ${module.description}`).join("\n");
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("module", "documentation", "category", actorId, "Getting_Started")).setLabel("Getting Started").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(componentId("module", "documentation", "modules", actorId)).setLabel("Modules").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(componentId("module", "documentation", "commands", actorId)).setLabel("Commands").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(componentId("module", "documentation", "search", actorId)).setLabel("Search").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(componentId("module", "documentation", "modules_all", actorId)).setLabel("Available").setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("📚 Bot Documentation").setDescription(`Browse setup, commands, configuration, permissions, and troubleshooting.\n\n${modules}`)], components: [buttons] };
}

export function documentList(title: string, documents: readonly IndexedDocument[], actorId: string) {
  const body = documents.slice(0, 10).map((page) => `**${page.title}** · ${page.moduleId}\n${page.summary}`).join("\n\n") || "No matching documentation.";
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle(title).setDescription(body)], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("module", "documentation", "home", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary))] };
}

export function commandList(registry: ModuleRegistry, actorId: string) {
  const lines = registry.all().flatMap((module) => module.commands.map((command) => `**/${command.data.name}** - ${module.manifest.name}${command.requirements.featureId ? ` · ${command.requirements.featureId}` : ""}`));
  return { embeds: [new EmbedBuilder().setColor(ui.colors.primary).setTitle("Command Reference").setDescription(lines.join("\n").slice(0, 4_000) || "No module commands are registered.")], components: [new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(componentId("module", "documentation", "home", actorId)).setLabel("Back").setStyle(ButtonStyle.Secondary))] };
}

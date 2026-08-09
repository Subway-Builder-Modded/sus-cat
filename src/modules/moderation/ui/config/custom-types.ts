import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

import { moduleConfigurationTitle } from "../../../../core/config/views.js";
import { componentId as coreComponentId } from "../../../../core/interactions/custom-id.js";
import { moderationManifest } from "../../manifest.js";
import { componentId } from "../../utils/custom-id.js";

export function customTypesConfigView(actorId: string) {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(moduleConfigurationTitle(moderationManifest, "Settings", "Custom Case Types"))
      .setDescription("Manage guild-specific case types, aliases, colors, and emoji.")],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(componentId("type_list", actorId)).setLabel("Custom Types").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(componentId("type_add", actorId)).setLabel("Add Type").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(coreComponentId("core", "config", "settings", actorId, "moderation")).setLabel("Back").setStyle(ButtonStyle.Secondary),
    )],
  };
}

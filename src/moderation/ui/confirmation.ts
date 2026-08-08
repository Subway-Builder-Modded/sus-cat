import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

import { componentId } from "../utils/custom-id.js";

export function confirmationButtons(token: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("confirm", token)).setLabel("Confirm").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(componentId("cancel", token)).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );
}

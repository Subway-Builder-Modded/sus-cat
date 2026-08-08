import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

import { componentId } from "../utils/custom-id.js";

export function confirmationButtons(token: string, confirmLabel = "Confirm") {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("confirm", token)).setLabel(confirmLabel.slice(0, 80)).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(componentId("cancel", token)).setLabel("Cancel").setStyle(ButtonStyle.Secondary),
  );
}

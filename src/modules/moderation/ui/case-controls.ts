import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

import type { ModerationCase } from "../database/schema.js";
import { componentId } from "../utils/custom-id.js";

export function caseControls(item: ModerationCase, viewerId: string) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(componentId("case_evidence", viewerId, item.id)).setLabel("Evidence").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(componentId("case_note", viewerId, item.id)).setLabel("Add Note").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(componentId("case_edit", viewerId, item.id)).setLabel("Edit Reason").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(componentId("history", viewerId, item.targetUserId, "1")).setLabel("User History").setStyle(ButtonStyle.Primary),
  );
  if (item.status === "active" && ["ban", "timeout"].includes(item.action)) {
    row.addComponents(new ButtonBuilder().setCustomId(componentId("case_reverse", viewerId, item.id)).setLabel("Reverse").setStyle(ButtonStyle.Danger));
  }
  return row;
}

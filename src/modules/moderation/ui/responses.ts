import { EmbedBuilder } from "discord.js";

import { moderationColors } from "./theme.js";

export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(moderationColors.success).setTitle(`✅ ${title}`).setDescription(description).setTimestamp();
}

export function errorEmbed(message: string, errorId?: string): EmbedBuilder {
  return new EmbedBuilder().setColor(moderationColors.destructive).setTitle("Unable to complete that action").setDescription(message).setFooter(errorId ? { text: `Error ID: ${errorId}` } : null);
}

export function confirmationEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder().setColor(moderationColors.destructive).setTitle(`⚠️ ${title}`).setDescription(description).setFooter({ text: "This confirmation expires in 2 minutes." });
}

import { EmbedBuilder, type Guild, type User } from "discord.js";

import type { ModerationAction } from "../../domain/types.js";
import { formatDuration } from "../../utils/duration.js";
import { actionPresentation } from "./presentation.js";

export function buildActionNotice(input: { action: ModerationAction; guild: Guild; reason?: string; durationMs?: number; expiresAt?: Date }): EmbedBuilder {
  const presentation = actionPresentation[input.action];
  const embed = new EmbedBuilder().setColor(presentation.color).setTitle(`${presentation.emoji} You have been ${presentation.dmVerb} ${input.guild.name}.`).setTimestamp();
  const icon = input.guild.iconURL();
  if (icon) embed.setThumbnail(icon);
  if (input.reason) embed.addFields({ name: "Reason", value: input.reason });
  if (input.durationMs) embed.addFields({ name: "Duration", value: formatDuration(input.durationMs), inline: true });
  if (input.expiresAt) embed.addFields({ name: "Ends", value: `<t:${Math.floor(input.expiresAt.getTime() / 1000)}:F>`, inline: true });
  return embed;
}

export async function sendActionNotice(user: User, input: Parameters<typeof buildActionNotice>[0]): Promise<boolean> {
  try { await user.send({ embeds: [buildActionNotice(input)], allowedMentions: { parse: [] } }); return true; }
  catch { return false; }
}

import { EmbedBuilder, type GuildMember, type User } from "discord.js";

import type { ModerationCaseEntry, ModerationUserCase } from "../../database/schema.js";
import type { ModerationAction } from "../../domain/types.js";
import { formatDuration } from "../../utils/duration.js";
import { actionPresentation } from "./presentation.js";

export function buildActionCard(input: { action: ModerationAction | "nickname" | "slowmode" | "lock" | "unlock" | "purge" | "sudo"; target?: User | GuildMember; actor: GuildMember; reason?: string; durationMs?: number; result?: string; case?: ModerationUserCase; entry?: ModerationCaseEntry; details?: { name: string; value: string; inline?: boolean }[]; evidence?: string }): EmbedBuilder {
  const presentation = actionPresentation[input.action];
  const user = input.target && "user" in input.target ? input.target.user : input.target;
  const embed = new EmbedBuilder().setColor(presentation.color).setTitle(`${presentation.emoji} ${presentation.pastTense}`).setTimestamp();
  if (user) embed.setThumbnail(user.displayAvatarURL()).addFields({ name: "User", value: `${user} \`${user.id}\``, inline: true });
  embed.addFields({ name: "Moderator", value: `${input.actor} \`${input.actor.id}\``, inline: true });
  if (input.result) embed.addFields({ name: "Result", value: input.result, inline: true });
  if (input.reason) embed.addFields({ name: "Reason", value: input.reason });
  if (input.durationMs) embed.addFields({ name: "Duration", value: formatDuration(input.durationMs), inline: true });
  if (input.case) embed.addFields({ name: "Case", value: `#${input.case.caseNumber}`, inline: true });
  for (const detail of input.details ?? []) embed.addFields(detail);
  if (input.evidence) embed.addFields({ name: "Evidence", value: input.evidence });
  return embed;
}

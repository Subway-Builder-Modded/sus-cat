import type { Guild } from "discord.js";

import { logger } from "../../../../core/shared/logger.js";
import { toError } from "../../../../core/shared/to-error.js";
import { buildActionCard } from "./action-card.js";

type ActionCardInput = Parameters<typeof buildActionCard>[0];

/** Publishes bot-originated moderation activity to the single configured Audit Log channel. */
export async function publishAuditLog(guild: Guild, auditLogChannelId: string, input: ActionCardInput): Promise<void> {
  try {
    const channel = await guild.channels.fetch(auditLogChannelId);
    if (channel?.isSendable()) await channel.send({ embeds: [buildActionCard(input)], allowedMentions: { parse: [] } });
  } catch (error: unknown) {
    logger.warn("Unable to publish audit log", { guildId: guild.id, action: input.action, error: toError(error).message });
  }
}

import type { GuildMember, RepliableInteraction, User } from "discord.js";

import { respond, type SafeReplyOptions } from "../../../core/interactions/response.js";
import type { ActionOutcome } from "../services/moderation-service.js";
import { buildActionCard } from "../ui/actions/action-card.js";

export function replyPrivately(interaction: RepliableInteraction, options: SafeReplyOptions): Promise<void> { return respond(interaction, options); }

export function replyWithOutcome(interaction: RepliableInteraction, input: { outcome: ActionOutcome; actor: GuildMember; target: User | GuildMember; reason?: string; durationMs?: number; evidence?: string }): Promise<void> {
  return respond(interaction, { embeds: [buildActionCard({ action: input.outcome.action, actor: input.actor, target: input.target, ...(input.reason ? { reason: input.reason } : {}), ...(input.durationMs ? { durationMs: input.durationMs } : {}), ...(input.outcome.case ? { case: input.outcome.case } : {}), ...(input.outcome.entry ? { entry: input.outcome.entry } : {}), ...(input.evidence ? { evidence: input.evidence } : {}) })] });
}

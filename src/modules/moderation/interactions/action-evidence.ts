import type { BotClient } from "../../../core/bot/bot-client.js";
import type { EvidenceResult } from "../domain/types.js";
import { requireModerationModule } from "../moderation-module.js";
import type { ActionOutcome } from "../services/moderation-service.js";

export async function requireActionEvidenceEnabled(client: BotClient, guildId: string, evidence?: string | null, silent?: boolean): Promise<void> {
  if (evidence && !silent && !await client.platform.settings.isFeatureEnabled(guildId, "moderation", "evidence")) {
    throw new Error("Evidence is disabled in this server. Remove the evidence option or enable Evidence.");
  }
}

export async function attachActionEvidence(client: BotClient, input: { guildId: string; actorId: string; interactionId: string; evidence?: string | null; outcome: ActionOutcome; result: EvidenceResult; silent?: boolean }): Promise<boolean> {
  if (!input.evidence || input.silent || !input.outcome.case) return false;
  // A feature can be disabled while a Discord action is in flight. The primary
  // action remains successful, but newly disabled evidence must not be stored.
  if (!await client.platform.settings.isFeatureEnabled(input.guildId, "moderation", "evidence")) return false;
  await requireModerationModule(client).evidence.add({ caseId: input.outcome.case.id, ...(input.outcome.entry ? { caseEntryId: input.outcome.entry.id } : {}), guildId: input.guildId, actorId: input.actorId, evidence: input.evidence, result: input.result, idempotencyKey: `${input.interactionId}:evidence` });
  return true;
}

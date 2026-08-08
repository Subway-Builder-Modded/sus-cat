import type { BotClient } from "../../../core/bot/bot-client.js";
import type { ActionOutcome } from "../services/moderation-service.js";
import type { EvidenceResult } from "../domain/types.js";

export async function attachActionEvidence(client: BotClient, input: { guildId: string; actorId: string; interactionId: string; evidence?: string | null; outcome: ActionOutcome; result: EvidenceResult; silent?: boolean }): Promise<void> {
  if (!input.evidence || input.silent) return;
  if (!await client.platform.settings.isFeatureEnabled(input.guildId, "moderation", "evidence")) throw new Error("Evidence is disabled in this server. Remove the evidence option or enable Evidence.");
  if (!input.outcome.case) return;
  await client.moderation!.cases.addEvidence({ caseId: input.outcome.case.id, ...(input.outcome.entry ? { caseEntryId: input.outcome.entry.id } : {}), guildId: input.guildId, actorId: input.actorId, evidence: input.evidence, result: input.result, idempotencyKey: `${input.interactionId}:evidence` });
}

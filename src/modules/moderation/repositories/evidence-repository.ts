import { and, asc, eq } from "drizzle-orm";

import type { Database } from "../../../core/database/client.js";
import { moderationAuditEvents, moderationCaseEntries, moderationEvidence, moderationUserCases, type ModerationEvidence } from "../database/schema.js";
import type { EvidenceResult } from "../domain/types.js";

export interface AddEvidenceInput {
  readonly caseId: string;
  readonly guildId: string;
  readonly actorId: string;
  readonly evidence: string;
  readonly idempotencyKey: string;
  readonly description?: string;
  readonly result?: EvidenceResult;
  readonly caseEntryId?: string;
  readonly metadata?: Record<string, unknown>;
}

export class EvidenceRepository {
  constructor(private readonly db: Database) {}

  async add(input: AddEvidenceInput): Promise<ModerationEvidence> {
    return this.db.transaction(async (transaction) => {
      const [userCase] = await transaction.select().from(moderationUserCases).where(and(eq(moderationUserCases.guildId, input.guildId), eq(moderationUserCases.id, input.caseId))).limit(1);
      if (!userCase) throw new Error("That case does not exist in this server.");
      if (input.caseEntryId) {
        const [entry] = await transaction.select({ id: moderationCaseEntries.id }).from(moderationCaseEntries).where(and(eq(moderationCaseEntries.guildId, input.guildId), eq(moderationCaseEntries.caseId, input.caseId), eq(moderationCaseEntries.id, input.caseEntryId))).limit(1);
        if (!entry) throw new Error("That case entry does not belong to this case.");
      }
      const [created] = await transaction.insert(moderationEvidence).values({
        caseId: input.caseId,
        guildId: input.guildId,
        addedById: input.actorId,
        evidence: input.evidence,
        idempotencyKey: input.idempotencyKey,
        result: input.result ?? "none",
        metadata: input.metadata ?? {},
        ...(input.description ? { description: input.description } : {}),
        ...(input.caseEntryId ? { caseEntryId: input.caseEntryId } : {}),
      }).onConflictDoNothing({ target: [moderationEvidence.guildId, moderationEvidence.idempotencyKey] }).returning();
      if (created) await transaction.insert(moderationAuditEvents).values({ eventType: "evidence.added", guildId: input.guildId, actorId: input.actorId, caseId: input.caseId, metadata: { evidenceId: created.id, result: created.result }, ...(input.caseEntryId ? { caseEntryId: input.caseEntryId } : {}) });
      const [stored] = await transaction.select().from(moderationEvidence).where(and(eq(moderationEvidence.guildId, input.guildId), eq(moderationEvidence.idempotencyKey, input.idempotencyKey))).limit(1);
      const evidence = created ?? stored;
      if (!evidence) throw new Error("Failed to add evidence.");
      return evidence;
    });
  }

  list(guildId: string, caseId: string): Promise<ModerationEvidence[]> {
    return this.db.select().from(moderationEvidence).where(and(eq(moderationEvidence.guildId, guildId), eq(moderationEvidence.caseId, caseId))).orderBy(asc(moderationEvidence.createdAt));
  }

  async edit(guildId: string, caseId: string, evidenceId: string, actorId: string, changes: { evidence?: string; description?: string | null; result?: EvidenceResult }): Promise<ModerationEvidence> {
    return this.db.transaction(async (transaction) => {
      const scope = and(eq(moderationEvidence.guildId, guildId), eq(moderationEvidence.caseId, caseId), eq(moderationEvidence.id, evidenceId));
      const [current] = await transaction.select().from(moderationEvidence).where(scope).limit(1);
      if (!current) throw new Error("That evidence item does not belong to this case.");
      const [updated] = await transaction.update(moderationEvidence).set({ ...changes, updatedAt: new Date() }).where(scope).returning();
      if (!updated) throw new Error("Failed to update evidence.");
      await transaction.insert(moderationAuditEvents).values({ eventType: "evidence.edited", guildId, actorId, caseId, caseEntryId: current.caseEntryId, metadata: { evidenceId }, before: { evidence: current.evidence, description: current.description, result: current.result }, after: changes });
      return updated;
    });
  }

  async delete(guildId: string, caseId: string, evidenceId: string, actorId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      const scope = and(eq(moderationEvidence.guildId, guildId), eq(moderationEvidence.caseId, caseId), eq(moderationEvidence.id, evidenceId));
      const [current] = await transaction.select().from(moderationEvidence).where(scope).limit(1);
      if (!current) throw new Error("That evidence item does not belong to this case.");
      await transaction.delete(moderationEvidence).where(scope);
      await transaction.insert(moderationAuditEvents).values({ eventType: "evidence.deleted", guildId, actorId, caseId, caseEntryId: current.caseEntryId, before: { evidenceId, evidence: current.evidence, description: current.description, result: current.result } });
    });
  }
}

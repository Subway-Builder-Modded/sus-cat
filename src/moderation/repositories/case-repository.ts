import { and, asc, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { Database } from "../../database/client.js";
import {
  moderationAuditEvents, moderationCaseRevisions, moderationCases, moderationDmAttempts,
  moderationEvidence, moderationNotes, moderationScheduledActions,
  type ModerationCase,
} from "../../database/schema.js";
import type { CaseHistoryPage, CaseSource, HistorySummary, ModerationAction, ModerationCaseStatus } from "../domain/types.js";
import { canTransitionCase } from "../domain/case-state.js";
import { normalizePage } from "../utils/pagination.js";

export interface CreateCaseInput {
  guildId: string;
  targetUserId: string;
  actorId: string;
  action: ModerationAction;
  reason: string;
  idempotencyKey: string;
  internalNote?: string;
  durationMs?: number;
  expiresAt?: Date;
  relatedCaseId?: string;
  source?: CaseSource;
  automated?: boolean;
  metadata?: Record<string, unknown>;
}

export class CaseRepository {
  constructor(private readonly db: Database) {}

  async create(input: CreateCaseInput): Promise<ModerationCase> {
    return this.db.transaction(async (tx) => {
      const existing = await tx.query.moderationCases.findFirst({
        where: and(eq(moderationCases.guildId, input.guildId), eq(moderationCases.idempotencyKey, input.idempotencyKey)),
      });
      if (existing) return existing;

      const counterResult = await tx.execute<{ case_number: number }>(sql`
        INSERT INTO moderation_guild_case_counters (guild_id, next_case_number)
        VALUES (${input.guildId}, 2)
        ON CONFLICT (guild_id) DO UPDATE SET next_case_number = moderation_guild_case_counters.next_case_number + 1
        RETURNING next_case_number - 1 AS case_number
      `);
      const caseNumber = Number(counterResult[0]?.case_number);
      if (!Number.isSafeInteger(caseNumber)) throw new Error("Failed to allocate a case number");

      const [created] = await tx.insert(moderationCases).values({
        caseNumber,
        guildId: input.guildId,
        targetUserId: input.targetUserId,
        actorId: input.actorId,
        action: input.action,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        ...(input.internalNote ? { internalNote: input.internalNote } : {}),
        ...(input.durationMs ? { durationMs: input.durationMs } : {}),
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
        ...(input.relatedCaseId ? { relatedCaseId: input.relatedCaseId } : {}),
        ...(input.source?.channelId ? { sourceChannelId: input.source.channelId } : {}),
        ...(input.source?.messageId ? { sourceMessageId: input.source.messageId } : {}),
        ...(input.source?.url ? { sourceUrl: input.source.url } : {}),
        automated: input.automated ?? false,
        auditMetadata: input.metadata ?? {},
      }).onConflictDoNothing({ target: [moderationCases.guildId, moderationCases.idempotencyKey] }).returning();
      if (!created) {
        const concurrent = await tx.query.moderationCases.findFirst({ where: and(eq(moderationCases.guildId, input.guildId), eq(moderationCases.idempotencyKey, input.idempotencyKey)) });
        if (!concurrent) throw new Error("Failed to create moderation case");
        return concurrent;
      }

      await tx.insert(moderationAuditEvents).values({
        eventType: "case.created", guildId: input.guildId, actorId: input.actorId,
        targetUserId: input.targetUserId, caseId: created.id, after: { action: input.action, reason: input.reason },
      });
      return created;
    });
  }

  async transition(caseId: string, status: ModerationCaseStatus, actorId: string, metadata: Record<string, unknown> = {}): Promise<ModerationCase> {
    return this.db.transaction(async (tx) => {
      const current = await tx.query.moderationCases.findFirst({ where: eq(moderationCases.id, caseId) });
      if (!current) throw new Error("Moderation case not found.");
      if (current.status === status) return current;
      if (!canTransitionCase(current.status, status)) throw new Error(`Case cannot move from ${current.status} to ${status}.`);
      const [updated] = await tx.update(moderationCases).set({ status, updatedAt: new Date() }).where(eq(moderationCases.id, caseId)).returning();
      if (!updated) throw new Error("Failed to update moderation case");
      await tx.insert(moderationAuditEvents).values({
        eventType: `case.${status}`, guildId: current.guildId, actorId, targetUserId: current.targetUserId,
        caseId, before: { status: current.status }, after: { status }, metadata,
      });
      return updated;
    });
  }

  async edit(caseId: string, actorId: string, changes: { reason?: string; internalNote?: string }): Promise<ModerationCase> {
    return this.db.transaction(async (tx) => {
      const current = await tx.query.moderationCases.findFirst({ where: eq(moderationCases.id, caseId) });
      if (!current) throw new Error("Moderation case not found.");
      const revisions = Object.entries(changes).filter(([, value]) => value !== undefined).map(([field, value]) => ({
        caseId, actorId, field, previousValue: field === "reason" ? current.reason : current.internalNote, nextValue: value,
      }));
      if (revisions.length === 0) return current;
      await tx.insert(moderationCaseRevisions).values(revisions);
      const [updated] = await tx.update(moderationCases).set({ ...changes, updatedAt: new Date() }).where(eq(moderationCases.id, caseId)).returning();
      await tx.insert(moderationAuditEvents).values({ eventType: "case.edited", guildId: current.guildId, actorId, targetUserId: current.targetUserId, caseId, before: { reason: current.reason, internalNote: current.internalNote }, after: changes });
      if (!updated) throw new Error("Failed to update moderation case");
      return updated;
    });
  }

  getByNumber(guildId: string, caseNumber: number): Promise<ModerationCase | undefined> {
    return this.db.query.moderationCases.findFirst({ where: and(eq(moderationCases.guildId, guildId), eq(moderationCases.caseNumber, caseNumber)) });
  }

  getById(caseId: string): Promise<ModerationCase | undefined> {
    return this.db.query.moderationCases.findFirst({ where: eq(moderationCases.id, caseId) });
  }

  async history(guildId: string, targetUserId: string, page = 1, pageSize = 5): Promise<CaseHistoryPage> {
    const [{ value: total = 0 } = { value: 0 }] = await this.db.select({ value: count() }).from(moderationCases).where(and(eq(moderationCases.guildId, guildId), eq(moderationCases.targetUserId, targetUserId)));
    const pagination = normalizePage(page, total, pageSize);
    const cases = await this.db.select().from(moderationCases).where(and(eq(moderationCases.guildId, guildId), eq(moderationCases.targetUserId, targetUserId))).orderBy(desc(moderationCases.createdAt)).limit(pageSize).offset(pagination.offset);
    return { cases, total, page: pagination.page, pages: pagination.pages };
  }

  async summary(guildId: string, targetUserId: string): Promise<HistorySummary> {
    const rows = await this.db.select({ action: moderationCases.action, status: moderationCases.status, value: count() }).from(moderationCases).where(and(eq(moderationCases.guildId, guildId), eq(moderationCases.targetUserId, targetUserId))).groupBy(moderationCases.action, moderationCases.status);
    const amount = (action: ModerationAction) => rows.filter((row) => row.action === action).reduce((sum, row) => sum + row.value, 0);
    return { total: rows.reduce((sum, row) => sum + row.value, 0), warnings: amount("warn"), timeouts: amount("timeout"), kicks: amount("kick"), bans: amount("ban"), notes: amount("note"), active: rows.filter((row) => row.status === "active").reduce((sum, row) => sum + row.value, 0) };
  }

  async recent(guildId: string, limit = 10): Promise<ModerationCase[]> {
    return this.db.select().from(moderationCases).where(eq(moderationCases.guildId, guildId)).orderBy(desc(moderationCases.createdAt)).limit(limit);
  }

  async active(guildId: string, limit = 25): Promise<ModerationCase[]> {
    return this.db.select().from(moderationCases).where(and(eq(moderationCases.guildId, guildId), eq(moderationCases.status, "active"), inArray(moderationCases.action, ["timeout", "ban"]))).orderBy(asc(moderationCases.expiresAt)).limit(limit);
  }

  async search(guildId: string, filters: { targetUserId?: string; actorId?: string; action?: ModerationAction; status?: ModerationCaseStatus; before?: Date; after?: Date }, limit = 25): Promise<ModerationCase[]> {
    const conditions = [eq(moderationCases.guildId, guildId)];
    if (filters.targetUserId) conditions.push(eq(moderationCases.targetUserId, filters.targetUserId));
    if (filters.actorId) conditions.push(eq(moderationCases.actorId, filters.actorId));
    if (filters.action) conditions.push(eq(moderationCases.action, filters.action));
    if (filters.status) conditions.push(eq(moderationCases.status, filters.status));
    if (filters.before) conditions.push(lte(moderationCases.createdAt, filters.before));
    if (filters.after) conditions.push(gte(moderationCases.createdAt, filters.after));
    return this.db.select().from(moderationCases).where(and(...conditions)).orderBy(desc(moderationCases.createdAt)).limit(limit);
  }

  async addEvidence(input: { caseId: string; guildId: string; actorId: string; type: "message" | "note" | "attachment" | "url"; source: string; description?: string; metadata?: Record<string, unknown> }) {
    const [created] = await this.db.insert(moderationEvidence).values({ caseId: input.caseId, guildId: input.guildId, addedById: input.actorId, type: input.type, source: input.source, ...(input.description ? { description: input.description } : {}), metadata: input.metadata ?? {} }).returning();
    await this.audit("evidence.added", input.guildId, input.actorId, input.caseId, undefined, { evidenceId: created?.id, type: input.type });
    return created;
  }

  listEvidence(caseId: string) {
    return this.db.select().from(moderationEvidence).where(eq(moderationEvidence.caseId, caseId)).orderBy(desc(moderationEvidence.createdAt));
  }

  async addNote(input: { guildId: string; targetUserId: string; actorId: string; content: string; caseId?: string }) {
    const [note] = await this.db.insert(moderationNotes).values({ guildId: input.guildId, targetUserId: input.targetUserId, authorId: input.actorId, content: input.content, ...(input.caseId ? { caseId: input.caseId } : {}) }).returning();
    await this.audit("note.created", input.guildId, input.actorId, input.caseId, input.targetUserId, { noteId: note?.id });
    return note;
  }

  listNotes(guildId: string, targetUserId: string, limit = 10) {
    return this.db.select().from(moderationNotes).where(and(eq(moderationNotes.guildId, guildId), eq(moderationNotes.targetUserId, targetUserId))).orderBy(desc(moderationNotes.createdAt)).limit(limit);
  }

  async schedule(caseId: string, guildId: string, targetUserId: string, action: string, executeAt: Date): Promise<void> {
    await this.db.insert(moderationScheduledActions).values({ caseId, guildId, targetUserId, action, executeAt }).onConflictDoNothing({ target: [moderationScheduledActions.caseId, moderationScheduledActions.action] });
  }

  async claimDue(limit = 10) {
    return this.db.transaction(async (tx) => {
      const result = await tx.execute<typeof moderationScheduledActions.$inferSelect>(sql`
        UPDATE moderation_scheduled_actions SET status = 'processing', attempts = attempts + 1, updated_at = now()
        WHERE id IN (SELECT id FROM moderation_scheduled_actions WHERE (status = 'pending' AND execute_at <= now()) OR (status = 'processing' AND updated_at < now() - interval '5 minutes') ORDER BY execute_at FOR UPDATE SKIP LOCKED LIMIT ${limit})
        RETURNING *
      `);
      return [...result];
    });
  }

  async finishScheduled(id: string, success: boolean, error?: string): Promise<void> {
    if (success) {
      await this.db.update(moderationScheduledActions).set({ status: "completed", updatedAt: new Date() }).where(eq(moderationScheduledActions.id, id));
      return;
    }
    await this.db.execute(sql`
      UPDATE moderation_scheduled_actions
      SET status = CASE WHEN attempts < 5 THEN 'pending'::moderation_scheduled_status ELSE 'failed'::moderation_scheduled_status END,
          execute_at = CASE WHEN attempts < 5 THEN now() + interval '1 minute' ELSE execute_at END,
          last_error = ${error ?? "Unknown error"}, updated_at = now()
      WHERE id = ${id}
    `);
  }

  async cancelScheduled(caseId: string): Promise<void> {
    await this.db.update(moderationScheduledActions).set({ status: "completed", updatedAt: new Date() }).where(and(eq(moderationScheduledActions.caseId, caseId), inArray(moderationScheduledActions.status, ["pending", "processing"])));
  }

  async recordDm(caseId: string, status: "sent" | "failed" | "disabled", errorCode?: string): Promise<void> {
    await this.db.insert(moderationDmAttempts).values({ caseId, status, ...(errorCode ? { errorCode } : {}) });
    await this.db.update(moderationCases).set({ dmDeliveryStatus: status, updatedAt: new Date() }).where(eq(moderationCases.id, caseId));
  }

  audit(eventType: string, guildId: string, actorId: string, caseId?: string, targetUserId?: string, metadata: Record<string, unknown> = {}): Promise<unknown> {
    return this.db.insert(moderationAuditEvents).values({ eventType, guildId, actorId, ...(caseId ? { caseId } : {}), ...(targetUserId ? { targetUserId } : {}), metadata });
  }
}

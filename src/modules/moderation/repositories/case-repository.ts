import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "../../../core/database/client.js";
import {
  moderationAuditEvents, moderationCaseEntries, moderationEvidence, moderationUserCases,
  type ModerationCaseEntry, type ModerationCustomCaseType, type ModerationUserCase,
} from "../database/schema.js";
import type { HistorySummary, ModerationAction, UserCasePage } from "../domain/types.js";
import { normalizePage } from "../utils/pagination.js";
import { resetModerationCases } from "./reset-repository.js";

export interface AppendEntryInput {
  guildId: string;
  targetUserId: string;
  actorId: string;
  action: ModerationAction;
  idempotencyKey: string;
  reason?: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
  customType?: ModerationCustomCaseType;
}

export class CaseRepository {
  constructor(private readonly db: Database) {}

  async append(input: AppendEntryInput): Promise<{ case: ModerationUserCase; entry: ModerationCaseEntry }> {
    return this.db.transaction(async (tx) => {
      const [duplicate] = await tx.select().from(moderationCaseEntries).where(and(eq(moderationCaseEntries.guildId, input.guildId), eq(moderationCaseEntries.idempotencyKey, input.idempotencyKey))).limit(1);
      if (duplicate) {
        const [existingCase] = await tx.select().from(moderationUserCases).where(and(eq(moderationUserCases.guildId, input.guildId), eq(moderationUserCases.id, duplicate.caseId))).limit(1);
        if (!existingCase) throw new Error("The existing case entry is orphaned.");
        return { case: existingCase, entry: duplicate };
      }

      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.guildId}), hashtext(${input.targetUserId}))`);
      let [userCase] = await tx.select().from(moderationUserCases).where(and(eq(moderationUserCases.guildId, input.guildId), eq(moderationUserCases.targetUserId, input.targetUserId))).limit(1);
      if (!userCase) {
        const counter = await tx.execute<{ case_number: number }>(sql`
          INSERT INTO moderation_guild_case_counters (guild_id, next_case_number) VALUES (${input.guildId}, 2)
          ON CONFLICT (guild_id) DO UPDATE SET next_case_number = moderation_guild_case_counters.next_case_number + 1
          RETURNING next_case_number - 1 AS case_number
        `);
        const caseNumber = Number(counter[0]?.case_number);
        if (!Number.isSafeInteger(caseNumber)) throw new Error("Failed to allocate a case number.");
        [userCase] = await tx.insert(moderationUserCases).values({ guildId: input.guildId, targetUserId: input.targetUserId, caseNumber }).returning();
      }
      if (!userCase) throw new Error("Failed to create the user case.");

      const [entry] = await tx.insert(moderationCaseEntries).values({
        caseId: userCase.id, guildId: input.guildId, actorId: input.actorId, action: input.action,
        idempotencyKey: input.idempotencyKey, metadata: input.metadata ?? {},
        ...(input.reason ? { reason: input.reason } : {}), ...(input.durationMs ? { durationMs: input.durationMs } : {}),
        ...(input.customType ? { customTypeId: input.customType.id, customTypeName: input.customType.name, customTypeColor: input.customType.color, customTypeEmoji: input.customType.emoji } : {}),
      }).returning();
      if (!entry) throw new Error("Failed to append the case entry.");
      await tx.update(moderationUserCases).set({ updatedAt: new Date() }).where(and(eq(moderationUserCases.guildId, input.guildId), eq(moderationUserCases.id, userCase.id)));
      await tx.insert(moderationAuditEvents).values({ eventType: "case.entry.created", guildId: input.guildId, actorId: input.actorId, targetUserId: input.targetUserId, caseId: userCase.id, caseEntryId: entry.id, sourceEventId: `entry:${input.idempotencyKey}`, after: { action: input.action } }).onConflictDoNothing();
      return { case: userCase, entry };
    });
  }

  async getByNumber(guildId: string, caseNumber: number): Promise<ModerationUserCase | undefined> {
    const [result] = await this.db.select().from(moderationUserCases).where(and(eq(moderationUserCases.guildId, guildId), eq(moderationUserCases.caseNumber, caseNumber))).limit(1);
    return result;
  }
  async getById(guildId: string, caseId: string): Promise<ModerationUserCase | undefined> {
    const [result] = await this.db.select().from(moderationUserCases).where(and(eq(moderationUserCases.guildId, guildId), eq(moderationUserCases.id, caseId))).limit(1);
    return result;
  }
  async getByUser(guildId: string, targetUserId: string): Promise<ModerationUserCase | undefined> {
    const [result] = await this.db.select().from(moderationUserCases).where(and(eq(moderationUserCases.guildId, guildId), eq(moderationUserCases.targetUserId, targetUserId))).limit(1);
    return result;
  }
  async findEntryByIdempotency(guildId: string, idempotencyKey: string): Promise<{ case: ModerationUserCase; entry: ModerationCaseEntry } | undefined> {
    const [entry] = await this.db.select().from(moderationCaseEntries).where(and(eq(moderationCaseEntries.guildId, guildId), eq(moderationCaseEntries.idempotencyKey, idempotencyKey))).limit(1);
    if (!entry) return undefined;
    const userCase = await this.getById(guildId, entry.caseId);
    return userCase ? { case: userCase, entry } : undefined;
  }

  async timeline(guildId: string, caseId: string, page = 1, pageSize = 5, actions?: readonly ModerationAction[]): Promise<UserCasePage | undefined> {
    const userCase = await this.getById(guildId, caseId);
    if (!userCase) return undefined;
    const where = actions?.length
      ? and(eq(moderationCaseEntries.guildId, guildId), eq(moderationCaseEntries.caseId, caseId), inArray(moderationCaseEntries.action, [...actions]))
      : and(eq(moderationCaseEntries.guildId, guildId), eq(moderationCaseEntries.caseId, caseId));
    const [{ value: total = 0 } = { value: 0 }] = await this.db.select({ value: count() }).from(moderationCaseEntries).where(where);
    const pagination = normalizePage(page, total, pageSize);
    const entries = await this.db.select().from(moderationCaseEntries).where(where).orderBy(desc(moderationCaseEntries.createdAt)).limit(pageSize).offset(pagination.offset);
    return { case: userCase, entries, total, page: pagination.page, pages: pagination.pages };
  }

  async summary(guildId: string, targetUserId: string): Promise<HistorySummary> {
    const userCase = await this.getByUser(guildId, targetUserId);
    if (!userCase) return { total: 0, warnings: 0, timeouts: 0, kicks: 0, bans: 0, unbans: 0, evidence: 0 };
    const rows = await this.db.select({ action: moderationCaseEntries.action, value: count() }).from(moderationCaseEntries).where(and(eq(moderationCaseEntries.guildId, guildId), eq(moderationCaseEntries.caseId, userCase.id))).groupBy(moderationCaseEntries.action);
    const amount = (action: ModerationAction) => rows.find((row) => row.action === action)?.value ?? 0;
    const [{ value: evidence = 0 } = { value: 0 }] = await this.db.select({ value: count() }).from(moderationEvidence).where(and(eq(moderationEvidence.guildId, guildId), eq(moderationEvidence.caseId, userCase.id)));
    return { total: rows.reduce((sum, row) => sum + row.value, 0), warnings: amount("warn"), timeouts: amount("timeout"), kicks: amount("kick"), bans: amount("ban"), unbans: amount("unban"), evidence };
  }

  async adjacent(guildId: string, caseNumber: number): Promise<{ previous?: ModerationUserCase; next?: ModerationUserCase }> {
    const all = await this.db.select().from(moderationUserCases).where(eq(moderationUserCases.guildId, guildId)).orderBy(asc(moderationUserCases.caseNumber));
    const index = all.findIndex((item) => item.caseNumber === caseNumber);
    return { ...(index > 0 ? { previous: all[index - 1] } : {}), ...(index >= 0 && index < all.length - 1 ? { next: all[index + 1] } : {}) };
  }
  async updateEntryMetadata(guildId: string, entryId: string, metadata: Record<string, unknown>): Promise<void> {
    await this.db.update(moderationCaseEntries).set({ metadata, updatedAt: new Date() }).where(and(eq(moderationCaseEntries.guildId, guildId), eq(moderationCaseEntries.id, entryId)));
  }

  async resetGuildCases(guildId: string): Promise<void> { await this.db.transaction((transaction) => resetModerationCases(transaction, guildId)); }
}

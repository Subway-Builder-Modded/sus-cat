import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import type { Database, DatabaseTransaction } from "../../../core/database/client.js";
import {
  guildCaseCounters, moderationActionReceipts, moderationAuditEvents, moderationCaseEntries, moderationCustomCaseTypeAliases,
  moderationCustomCaseTypes, moderationEvidence, moderationLockStates, moderationUserCases,
  type ModerationCaseEntry, type ModerationCustomCaseType, type ModerationEvidence, type ModerationUserCase,
} from "../database/schema.js";
import type { EvidenceResult, HistorySummary, ModerationAction, UserCasePage } from "../domain/types.js";
import { normalizePage } from "../utils/pagination.js";

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
      const duplicate = await tx.query.moderationCaseEntries.findFirst({ where: and(eq(moderationCaseEntries.guildId, input.guildId), eq(moderationCaseEntries.idempotencyKey, input.idempotencyKey)) });
      if (duplicate) {
        const existingCase = await tx.query.moderationUserCases.findFirst({ where: eq(moderationUserCases.id, duplicate.caseId) });
        if (!existingCase) throw new Error("The existing case entry is orphaned.");
        return { case: existingCase, entry: duplicate };
      }

      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.guildId}), hashtext(${input.targetUserId}))`);
      let userCase = await tx.query.moderationUserCases.findFirst({ where: and(eq(moderationUserCases.guildId, input.guildId), eq(moderationUserCases.targetUserId, input.targetUserId)) });
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
      await tx.update(moderationUserCases).set({ updatedAt: new Date() }).where(eq(moderationUserCases.id, userCase.id));
      await tx.insert(moderationAuditEvents).values({ eventType: "case.entry.created", guildId: input.guildId, actorId: input.actorId, targetUserId: input.targetUserId, caseId: userCase.id, caseEntryId: entry.id, sourceEventId: `entry:${input.idempotencyKey}`, after: { action: input.action } }).onConflictDoNothing();
      return { case: userCase, entry };
    });
  }

  getByNumber(guildId: string, caseNumber: number): Promise<ModerationUserCase | undefined> {
    return this.db.query.moderationUserCases.findFirst({ where: and(eq(moderationUserCases.guildId, guildId), eq(moderationUserCases.caseNumber, caseNumber)) });
  }
  getById(caseId: string): Promise<ModerationUserCase | undefined> { return this.db.query.moderationUserCases.findFirst({ where: eq(moderationUserCases.id, caseId) }); }
  getByUser(guildId: string, targetUserId: string): Promise<ModerationUserCase | undefined> {
    return this.db.query.moderationUserCases.findFirst({ where: and(eq(moderationUserCases.guildId, guildId), eq(moderationUserCases.targetUserId, targetUserId)) });
  }
  async findEntryByIdempotency(guildId: string, idempotencyKey: string): Promise<{ case: ModerationUserCase; entry: ModerationCaseEntry } | undefined> {
    const entry = await this.db.query.moderationCaseEntries.findFirst({ where: and(eq(moderationCaseEntries.guildId, guildId), eq(moderationCaseEntries.idempotencyKey, idempotencyKey)) });
    if (!entry) return undefined;
    const userCase = await this.getById(entry.caseId);
    return userCase ? { case: userCase, entry } : undefined;
  }

  async reserveAction(guildId: string, actorId: string, targetUserId: string | undefined, idempotencyKey: string, action: string): Promise<boolean> {
    const [created] = await this.db.insert(moderationActionReceipts).values({ guildId, actorId, targetUserId, idempotencyKey, action }).onConflictDoNothing({ target: [moderationActionReceipts.guildId, moderationActionReceipts.idempotencyKey] }).returning({ id: moderationActionReceipts.id });
    return Boolean(created);
  }

  async timeline(caseId: string, page = 1, pageSize = 5, actions?: readonly ModerationAction[]): Promise<UserCasePage | undefined> {
    const userCase = await this.getById(caseId);
    if (!userCase) return undefined;
    const where = actions?.length ? and(eq(moderationCaseEntries.caseId, caseId), inArray(moderationCaseEntries.action, [...actions])) : eq(moderationCaseEntries.caseId, caseId);
    const [{ value: total = 0 } = { value: 0 }] = await this.db.select({ value: count() }).from(moderationCaseEntries).where(where);
    const pagination = normalizePage(page, total, pageSize);
    const entries = await this.db.select().from(moderationCaseEntries).where(where).orderBy(desc(moderationCaseEntries.createdAt)).limit(pageSize).offset(pagination.offset);
    return { case: userCase, entries, total, page: pagination.page, pages: pagination.pages };
  }

  async summary(guildId: string, targetUserId: string): Promise<HistorySummary> {
    const userCase = await this.getByUser(guildId, targetUserId);
    if (!userCase) return { total: 0, warnings: 0, timeouts: 0, kicks: 0, bans: 0, unbans: 0, evidence: 0 };
    const rows = await this.db.select({ action: moderationCaseEntries.action, value: count() }).from(moderationCaseEntries).where(eq(moderationCaseEntries.caseId, userCase.id)).groupBy(moderationCaseEntries.action);
    const amount = (action: ModerationAction) => rows.find((row) => row.action === action)?.value ?? 0;
    const [{ value: evidence = 0 } = { value: 0 }] = await this.db.select({ value: count() }).from(moderationEvidence).where(eq(moderationEvidence.caseId, userCase.id));
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

  async addEvidence(input: { caseId: string; guildId: string; actorId: string; evidence: string; idempotencyKey: string; description?: string; result?: EvidenceResult; caseEntryId?: string; metadata?: Record<string, unknown> }): Promise<ModerationEvidence> {
    const item = await this.getById(input.caseId);
    if (!item || item.guildId !== input.guildId) throw new Error("That case does not exist in this server.");
    const [created] = await this.db.insert(moderationEvidence).values({ caseId: input.caseId, guildId: input.guildId, addedById: input.actorId, evidence: input.evidence, idempotencyKey: input.idempotencyKey, result: input.result ?? "none", metadata: input.metadata ?? {}, ...(input.description ? { description: input.description } : {}), ...(input.caseEntryId ? { caseEntryId: input.caseEntryId } : {}) }).onConflictDoNothing({ target: [moderationEvidence.guildId, moderationEvidence.idempotencyKey] }).returning();
    if (created) await this.audit("evidence.added", input.guildId, input.actorId, input.caseId, item.targetUserId, { evidenceId: created.id, result: created.result }, input.caseEntryId);
    const existing = created ?? await this.db.query.moderationEvidence.findFirst({ where: and(eq(moderationEvidence.guildId, input.guildId), eq(moderationEvidence.idempotencyKey, input.idempotencyKey)) });
    if (!existing) throw new Error("Failed to add evidence.");
    return existing;
  }

  listEvidence(caseId: string): Promise<ModerationEvidence[]> { return this.db.select().from(moderationEvidence).where(eq(moderationEvidence.caseId, caseId)).orderBy(asc(moderationEvidence.createdAt)); }
  async editEvidence(guildId: string, evidenceId: string, actorId: string, changes: { evidence?: string; description?: string | null; result?: EvidenceResult }): Promise<ModerationEvidence> {
    const current = await this.db.query.moderationEvidence.findFirst({ where: and(eq(moderationEvidence.id, evidenceId), eq(moderationEvidence.guildId, guildId)) });
    if (!current) throw new Error("That evidence item does not exist.");
    const [updated] = await this.db.update(moderationEvidence).set({ ...changes, updatedAt: new Date() }).where(eq(moderationEvidence.id, evidenceId)).returning();
    if (!updated) throw new Error("Failed to update evidence.");
    await this.audit("evidence.edited", guildId, actorId, current.caseId, undefined, { evidenceId }, current.caseEntryId ?? undefined, { evidence: current.evidence, description: current.description, result: current.result }, changes);
    return updated;
  }
  async deleteEvidence(guildId: string, evidenceId: string, actorId: string): Promise<void> {
    const current = await this.db.query.moderationEvidence.findFirst({ where: and(eq(moderationEvidence.id, evidenceId), eq(moderationEvidence.guildId, guildId)) });
    if (!current) throw new Error("That evidence item does not exist.");
    await this.db.transaction(async (tx) => {
      await tx.delete(moderationEvidence).where(eq(moderationEvidence.id, evidenceId));
      await tx.insert(moderationAuditEvents).values({ eventType: "evidence.deleted", guildId, actorId, caseId: current.caseId, caseEntryId: current.caseEntryId, before: { evidenceId, evidence: current.evidence, description: current.description, result: current.result } });
    });
  }

  async createCustomType(guildId: string, actorId: string, input: { name: string; aliases: string[]; color: number; emoji: string }): Promise<ModerationCustomCaseType> {
    return this.db.transaction(async (tx) => {
      const normalizedName = normalize(input.name);
      const aliases = [...new Set(input.aliases.map(normalize).filter(Boolean))];
      await ensureTypeNamesAvailable(tx, guildId, [normalizedName, ...aliases]);
      const [created] = await tx.insert(moderationCustomCaseTypes).values({ guildId, name: input.name.trim(), normalizedName, color: input.color, emoji: input.emoji.trim() }).returning();
      if (!created) throw new Error("Failed to create the custom type.");
      if (aliases.length) await tx.insert(moderationCustomCaseTypeAliases).values(aliases.map((alias) => ({ guildId, customTypeId: created.id, alias, normalizedAlias: alias })));
      await tx.insert(moderationAuditEvents).values({ eventType: "case_type.created", guildId, actorId, after: { id: created.id, name: created.name, aliases, color: created.color, emoji: created.emoji } });
      return created;
    });
  }

  async resolveCustomType(guildId: string, value: string): Promise<ModerationCustomCaseType | undefined> {
    const direct = UUID_PATTERN.test(value) ? await this.db.query.moderationCustomCaseTypes.findFirst({ where: and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.id, value), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`) }) : undefined;
    if (direct) return direct;
    const normalized = normalize(value);
    const byName = await this.db.query.moderationCustomCaseTypes.findFirst({ where: and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.normalizedName, normalized), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`) });
    if (byName) return byName;
    const alias = await this.db.query.moderationCustomCaseTypeAliases.findFirst({ where: and(eq(moderationCustomCaseTypeAliases.guildId, guildId), eq(moderationCustomCaseTypeAliases.normalizedAlias, normalized)) });
    return alias ? this.db.query.moderationCustomCaseTypes.findFirst({ where: and(eq(moderationCustomCaseTypes.id, alias.customTypeId), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`) }) : undefined;
  }

  async autocompleteTypes(guildId: string, query: string, limit = 25): Promise<{ name: string; value: string }[]> {
    const pattern = `%${query.trim()}%`;
    const types = await this.db.selectDistinct({ id: moderationCustomCaseTypes.id, name: moderationCustomCaseTypes.name }).from(moderationCustomCaseTypes).leftJoin(moderationCustomCaseTypeAliases, eq(moderationCustomCaseTypeAliases.customTypeId, moderationCustomCaseTypes.id)).where(and(eq(moderationCustomCaseTypes.guildId, guildId), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`, or(ilike(moderationCustomCaseTypes.name, pattern), ilike(moderationCustomCaseTypeAliases.alias, pattern)))).orderBy(asc(moderationCustomCaseTypes.name)).limit(Math.min(limit, 25));
    return types.map((type) => ({ name: type.name, value: type.id }));
  }
  listCustomTypes(guildId: string): Promise<ModerationCustomCaseType[]> {
    return this.db.select().from(moderationCustomCaseTypes).where(and(eq(moderationCustomCaseTypes.guildId, guildId), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`)).orderBy(asc(moderationCustomCaseTypes.name));
  }
  async customTypeAliases(guildId: string, typeId: string): Promise<string[]> {
    return (await this.db.select({ alias: moderationCustomCaseTypeAliases.alias }).from(moderationCustomCaseTypeAliases).where(and(eq(moderationCustomCaseTypeAliases.guildId, guildId), eq(moderationCustomCaseTypeAliases.customTypeId, typeId))).orderBy(asc(moderationCustomCaseTypeAliases.alias))).map((item) => item.alias);
  }
  async updateCustomType(guildId: string, typeId: string, actorId: string, input: { name: string; aliases: string[]; color: number; emoji: string }): Promise<ModerationCustomCaseType> {
    return this.db.transaction(async (tx) => {
      const current = await tx.query.moderationCustomCaseTypes.findFirst({ where: and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.id, typeId), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`) });
      if (!current) throw new Error("That custom type does not exist.");
      const normalizedName = normalize(input.name), aliases = [...new Set(input.aliases.map(normalize).filter(Boolean))];
      await tx.delete(moderationCustomCaseTypeAliases).where(eq(moderationCustomCaseTypeAliases.customTypeId, typeId));
      await tx.update(moderationCustomCaseTypes).set({ normalizedName: `editing-${typeId}` }).where(eq(moderationCustomCaseTypes.id, typeId));
      await ensureTypeNamesAvailable(tx, guildId, [normalizedName, ...aliases]);
      const [updated] = await tx.update(moderationCustomCaseTypes).set({ name: input.name.trim(), normalizedName, color: input.color, emoji: input.emoji.trim(), updatedAt: new Date() }).where(eq(moderationCustomCaseTypes.id, typeId)).returning();
      if (!updated) throw new Error("Failed to update the custom type.");
      if (aliases.length) await tx.insert(moderationCustomCaseTypeAliases).values(aliases.map((alias) => ({ guildId, customTypeId: typeId, alias, normalizedAlias: alias })));
      await tx.insert(moderationAuditEvents).values({ eventType: "case_type.edited", guildId, actorId, before: { name: current.name, color: current.color, emoji: current.emoji }, after: { name: updated.name, aliases, color: updated.color, emoji: updated.emoji } });
      return updated;
    });
  }

  async deleteCustomType(guildId: string, typeId: string, actorId: string): Promise<void> {
    const deleted = await this.db.transaction(async (tx) => {
      await tx.delete(moderationCustomCaseTypeAliases).where(and(eq(moderationCustomCaseTypeAliases.guildId, guildId), eq(moderationCustomCaseTypeAliases.customTypeId, typeId)));
      const [item] = await tx.update(moderationCustomCaseTypes).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(moderationCustomCaseTypes.guildId, guildId), eq(moderationCustomCaseTypes.id, typeId))).returning();
      return item;
    });
    if (!deleted) throw new Error("That custom type does not exist.");
    await this.audit("case_type.deleted", guildId, actorId, undefined, undefined, { typeId, name: deleted.name });
  }

  async resetGuildCases(guildId: string): Promise<void> { await this.db.transaction((tx) => resetModerationCases(tx, guildId)); }

  audit(eventType: string, guildId: string, actorId: string, caseId?: string, targetUserId?: string, metadata: Record<string, unknown> = {}, caseEntryId?: string, before?: Record<string, unknown>, after?: Record<string, unknown>, sourceEventId?: string): Promise<unknown> {
    return this.db.insert(moderationAuditEvents).values({ eventType, guildId, actorId, metadata, ...(caseId ? { caseId } : {}), ...(targetUserId ? { targetUserId } : {}), ...(caseEntryId ? { caseEntryId } : {}), ...(before ? { before } : {}), ...(after ? { after } : {}), ...(sourceEventId ? { sourceEventId } : {}) }).onConflictDoNothing();
  }
  async recordNativeAudit(input: { guildId: string; actorId: string; targetUserId?: string; sourceEventId: string; eventType: string; metadata: Record<string, unknown>; before?: Record<string, unknown>; after?: Record<string, unknown> }): Promise<boolean> {
    const [created] = await this.db.insert(moderationAuditEvents).values(input).onConflictDoNothing({ target: [moderationAuditEvents.guildId, moderationAuditEvents.sourceEventId] }).returning({ id: moderationAuditEvents.id });
    return Boolean(created);
  }
}

export async function resetModerationCases(tx: DatabaseTransaction, guildId: string): Promise<void> {
  await tx.delete(moderationAuditEvents).where(eq(moderationAuditEvents.guildId, guildId));
  await tx.delete(moderationCustomCaseTypeAliases).where(eq(moderationCustomCaseTypeAliases.guildId, guildId));
  await tx.delete(moderationCustomCaseTypes).where(eq(moderationCustomCaseTypes.guildId, guildId));
  await tx.delete(moderationUserCases).where(eq(moderationUserCases.guildId, guildId));
  await tx.delete(guildCaseCounters).where(eq(guildCaseCounters.guildId, guildId));
}

export async function resetModerationGuild(tx: DatabaseTransaction, guildId: string): Promise<void> {
  await resetModerationCases(tx, guildId);
  await tx.delete(moderationActionReceipts).where(eq(moderationActionReceipts.guildId, guildId));
  await tx.delete(moderationLockStates).where(eq(moderationLockStates.guildId, guildId));
}

async function ensureTypeNamesAvailable(tx: DatabaseTransaction, guildId: string, values: string[]): Promise<void> {
  if (!values.length || values.some((value) => !value)) throw new Error("Names and aliases cannot be blank.");
  if (new Set(values).size !== values.length) throw new Error("A custom type name and its aliases must be unique.");
  const names = await tx.select({ value: moderationCustomCaseTypes.normalizedName }).from(moderationCustomCaseTypes).where(and(eq(moderationCustomCaseTypes.guildId, guildId), inArray(moderationCustomCaseTypes.normalizedName, values), sql`${moderationCustomCaseTypes.deletedAt} IS NULL`));
  const aliases = await tx.select({ value: moderationCustomCaseTypeAliases.normalizedAlias }).from(moderationCustomCaseTypeAliases).where(and(eq(moderationCustomCaseTypeAliases.guildId, guildId), inArray(moderationCustomCaseTypeAliases.normalizedAlias, values)));
  const duplicate = names[0]?.value ?? aliases[0]?.value;
  if (duplicate) throw new Error(`The name or alias \`${duplicate}\` is already in use in this server.`);
}

function normalize(value: string): string { return value.trim().toLocaleLowerCase("en-US"); }
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

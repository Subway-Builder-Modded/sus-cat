import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const caseEntryAction = pgEnum("moderation_entry_action", [
  "manual", "warn", "timeout", "untimeout", "kick", "ban", "unban", "create_channel",
  "legacy_note", "legacy_softban", "legacy_automated",
]);
export const evidenceResult = pgEnum("moderation_evidence_result", ["none", "warn", "timeout", "kick", "ban", "unban", "untimeout"]);

export const guildCaseCounters = pgTable("moderation_guild_case_counters", {
  guildId: varchar("guild_id", { length: 20 }).primaryKey(),
  nextCaseNumber: integer("next_case_number").notNull().default(1),
});

export const moderationUserCases = pgTable("moderation_user_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  caseNumber: integer("case_number").notNull(),
  targetUserId: varchar("target_user_id", { length: 20 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("moderation_user_cases_guild_target_unique").on(table.guildId, table.targetUserId),
  uniqueIndex("moderation_user_cases_guild_number_unique").on(table.guildId, table.caseNumber),
  index("moderation_user_cases_target_idx").on(table.guildId, table.targetUserId),
]);

export const moderationCustomCaseTypes = pgTable("moderation_custom_case_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  name: varchar("name", { length: 80 }).notNull(),
  normalizedName: varchar("normalized_name", { length: 80 }).notNull(),
  color: integer("color").notNull(),
  emoji: varchar("emoji", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("moderation_custom_types_name_unique").on(table.guildId, table.normalizedName).where(sql`${table.deletedAt} IS NULL`),
  index("moderation_custom_types_guild_idx").on(table.guildId, table.deletedAt),
]);

export const moderationCustomCaseTypeAliases = pgTable("moderation_custom_case_type_aliases", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  customTypeId: uuid("custom_type_id").notNull().references(() => moderationCustomCaseTypes.id, { onDelete: "cascade" }),
  alias: varchar("alias", { length: 80 }).notNull(),
  normalizedAlias: varchar("normalized_alias", { length: 80 }).notNull(),
}, (table) => [
  uniqueIndex("moderation_custom_alias_guild_unique").on(table.guildId, table.normalizedAlias),
  index("moderation_custom_alias_type_idx").on(table.customTypeId),
]);

export const moderationCaseEntries = pgTable("moderation_case_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => moderationUserCases.id, { onDelete: "cascade" }),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  actorId: varchar("actor_id", { length: 20 }).notNull(),
  action: caseEntryAction("action").notNull(),
  customTypeId: uuid("custom_type_id").references(() => moderationCustomCaseTypes.id, { onDelete: "set null" }),
  customTypeName: varchar("custom_type_name", { length: 80 }),
  customTypeColor: integer("custom_type_color"),
  customTypeEmoji: varchar("custom_type_emoji", { length: 100 }),
  reason: text("reason"),
  durationMs: integer("duration_ms"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("moderation_case_entries_idempotency_unique").on(table.guildId, table.idempotencyKey),
  index("moderation_case_entries_timeline_idx").on(table.caseId, table.createdAt),
  index("moderation_case_entries_action_idx").on(table.guildId, table.action, table.createdAt),
]);

export const moderationEvidence = pgTable("moderation_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => moderationUserCases.id, { onDelete: "cascade" }),
  caseEntryId: uuid("case_entry_id").references(() => moderationCaseEntries.id, { onDelete: "set null" }),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  addedById: varchar("added_by_id", { length: 20 }).notNull(),
  evidence: text("evidence").notNull(),
  description: text("description"),
  result: evidenceResult("result").notNull().default("none"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("moderation_evidence_idempotency_unique").on(table.guildId, table.idempotencyKey),
  index("moderation_evidence_case_idx").on(table.caseId, table.createdAt),
  index("moderation_evidence_entry_idx").on(table.caseEntryId),
]);

export const moderationAuditEvents = pgTable("moderation_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  actorId: varchar("actor_id", { length: 20 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 20 }),
  caseId: uuid("case_id"),
  caseEntryId: uuid("case_entry_id"),
  sourceEventId: varchar("source_event_id", { length: 100 }),
  before: jsonb("before_value").$type<Record<string, unknown>>(),
  after: jsonb("after_value").$type<Record<string, unknown>>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("moderation_audit_guild_idx").on(table.guildId, table.createdAt),
  uniqueIndex("moderation_audit_source_unique").on(table.guildId, table.sourceEventId),
]);

export const moderationActionReceipts = pgTable("moderation_action_receipts", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
  action: varchar("action", { length: 40 }).notNull(),
  actorId: varchar("actor_id", { length: 20 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 20 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("moderation_action_receipts_key_unique").on(table.guildId, table.idempotencyKey),
  index("moderation_action_receipts_guild_idx").on(table.guildId, table.createdAt),
]);

export const moderationLockStates = pgTable("moderation_lock_states", {
  channelId: varchar("channel_id", { length: 20 }).notNull(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  actorId: varchar("actor_id", { length: 20 }).notNull(),
  previousSendMessages: boolean("previous_send_messages"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ name: "moderation_lock_states_guild_channel_pk", columns: [table.guildId, table.channelId] })]);

export type ModerationUserCase = typeof moderationUserCases.$inferSelect;
export type ModerationCaseEntry = typeof moderationCaseEntries.$inferSelect;
export type ModerationEvidence = typeof moderationEvidence.$inferSelect;
export type ModerationCustomCaseType = typeof moderationCustomCaseTypes.$inferSelect;

export interface ModerationConfig {
  readonly guildId: string;
  readonly auditLogChannelId: string | null;
  readonly caseCategoryId: string | null;
  readonly moderatorRoleIds: string[];
  readonly rulesUrl: string | null;
  readonly purgeConfirmationThreshold: number;
  readonly purgeScanLimit: number;
  readonly auditScope: "moderation" | "full";
}

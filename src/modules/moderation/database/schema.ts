import {
  boolean,
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const caseAction = pgEnum("moderation_action", [
  "warn", "note", "timeout", "untimeout", "kick", "ban", "unban", "softban", "nick", "manual", "automated",
]);
export const caseStatus = pgEnum("moderation_case_status", [
  "pending", "active", "expired", "reversed", "voided", "superseded", "failed",
]);
export const evidenceType = pgEnum("moderation_evidence_type", ["message", "note", "attachment", "url"]);
export const dmStatus = pgEnum("moderation_dm_status", ["sent", "failed", "disabled"]);
export const scheduledStatus = pgEnum("moderation_scheduled_status", ["pending", "processing", "completed", "failed"]);

export const guildCaseCounters = pgTable("moderation_guild_case_counters", {
  guildId: varchar("guild_id", { length: 20 }).primaryKey(),
  nextCaseNumber: integer("next_case_number").notNull().default(1),
});

export const moderationCases = pgTable("moderation_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseNumber: integer("case_number").notNull(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 20 }).notNull(),
  actorId: varchar("actor_id", { length: 20 }).notNull(),
  action: caseAction("action").notNull(),
  reason: text("reason").notNull(),
  internalNote: text("internal_note"),
  durationMs: integer("duration_ms"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  status: caseStatus("status").notNull().default("pending"),
  automated: boolean("automated").notNull().default(false),
  relatedCaseId: uuid("related_case_id").references((): AnyPgColumn => moderationCases.id),
  sourceChannelId: varchar("source_channel_id", { length: 20 }),
  sourceMessageId: varchar("source_message_id", { length: 20 }),
  sourceUrl: text("source_url"),
  dmDeliveryStatus: dmStatus("dm_delivery_status"),
  idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
  auditMetadata: jsonb("audit_metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("moderation_cases_guild_number_unique").on(table.guildId, table.caseNumber),
  uniqueIndex("moderation_cases_idempotency_unique").on(table.guildId, table.idempotencyKey),
  index("moderation_cases_target_history_idx").on(table.guildId, table.targetUserId, table.createdAt),
  index("moderation_cases_status_expiration_idx").on(table.status, table.expiresAt),
  index("moderation_cases_actor_idx").on(table.guildId, table.actorId),
]);

export const moderationCaseRevisions = pgTable("moderation_case_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => moderationCases.id),
  actorId: varchar("actor_id", { length: 20 }).notNull(),
  field: varchar("field", { length: 40 }).notNull(),
  previousValue: text("previous_value"),
  nextValue: text("next_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("moderation_case_revisions_case_idx").on(table.caseId, table.createdAt)]);

export const moderationEvidence = pgTable("moderation_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => moderationCases.id),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  addedById: varchar("added_by_id", { length: 20 }).notNull(),
  type: evidenceType("type").notNull(),
  source: text("source").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("moderation_evidence_case_idx").on(table.caseId, table.createdAt)]);

export const moderationNotes = pgTable("moderation_notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 20 }).notNull(),
  authorId: varchar("author_id", { length: 20 }).notNull(),
  caseId: uuid("case_id").references(() => moderationCases.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("moderation_notes_target_idx").on(table.guildId, table.targetUserId, table.createdAt)]);

export const moderationNoteRevisions = pgTable("moderation_note_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  noteId: uuid("note_id").notNull().references(() => moderationNotes.id),
  actorId: varchar("actor_id", { length: 20 }).notNull(),
  previousContent: text("previous_content").notNull(),
  nextContent: text("next_content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moderationAuditEvents = pgTable("moderation_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  actorId: varchar("actor_id", { length: 20 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 20 }),
  caseId: uuid("case_id").references(() => moderationCases.id),
  before: jsonb("before_value").$type<Record<string, unknown>>(),
  after: jsonb("after_value").$type<Record<string, unknown>>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("moderation_audit_guild_idx").on(table.guildId, table.createdAt)]);

export const moderationLockStates = pgTable("moderation_lock_states", {
  channelId: varchar("channel_id", { length: 20 }).primaryKey(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  actorId: varchar("actor_id", { length: 20 }).notNull(),
  previousSendMessages: boolean("previous_send_messages"),
  reason: text("reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const moderationScheduledActions = pgTable("moderation_scheduled_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  targetUserId: varchar("target_user_id", { length: 20 }).notNull(),
  caseId: uuid("case_id").notNull().references(() => moderationCases.id),
  action: varchar("action", { length: 40 }).notNull(),
  executeAt: timestamp("execute_at", { withTimezone: true }).notNull(),
  status: scheduledStatus("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("moderation_scheduled_due_idx").on(table.status, table.executeAt),
  uniqueIndex("moderation_scheduled_case_action_unique").on(table.caseId, table.action),
]);

export const moderationDmAttempts = pgTable("moderation_dm_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id").notNull().references(() => moderationCases.id),
  status: dmStatus("status").notNull(),
  errorCode: varchar("error_code", { length: 80 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ModerationCase = typeof moderationCases.$inferSelect;
export interface ModerationConfig {
  readonly guildId: string;
  readonly modLogChannelId: string | null;
  readonly auditLogChannelId: string | null;
  readonly dmUsers: boolean;
  readonly rulesUrl: string | null;
  readonly purgeConfirmationThreshold: number;
  readonly staffRoleIds: string[];
  readonly reasonPresets: string[];
  readonly notesEnabled: boolean;
  readonly temporaryBansEnabled: boolean;
  readonly caseButtonsEnabled: boolean;
  readonly updatedAt: Date;
}

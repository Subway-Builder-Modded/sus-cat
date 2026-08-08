import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const guildSetupStatus = pgEnum("guild_setup_status", ["unconfigured", "configuring", "configured"]);

export const guildSettings = pgTable("guild_settings", {
  guildId: varchar("guild_id", { length: 20 }).primaryKey(),
  setupStatus: guildSetupStatus("setup_status").notNull().default("unconfigured"),
  setupVersion: integer("setup_version").notNull().default(1),
  setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }),
  setupCompletedBy: varchar("setup_completed_by", { length: 20 }),
  botAdminRoleIds: jsonb("bot_admin_role_ids").$type<string[]>().notNull().default([]),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const guildModules = pgTable("guild_modules", {
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  moduleId: varchar("module_id", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("guild_modules_identity").on(table.guildId, table.moduleId)]);

export const guildFeatures = pgTable("guild_features", {
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  moduleId: varchar("module_id", { length: 64 }).notNull(),
  featureId: varchar("feature_id", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("guild_features_identity").on(table.guildId, table.moduleId, table.featureId)]);

export const configurationAuditEvents = pgTable("configuration_audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  guildId: varchar("guild_id", { length: 20 }).notNull(),
  actorId: varchar("actor_id", { length: 20 }).notNull(),
  moduleId: varchar("module_id", { length: 64 }).notNull(),
  featureId: varchar("feature_id", { length: 64 }),
  key: varchar("key", { length: 100 }).notNull(),
  before: jsonb("before_value").$type<unknown>(),
  after: jsonb("after_value").$type<unknown>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("configuration_audit_guild_idx").on(table.guildId, table.createdAt)]);

export type GuildSetting = typeof guildSettings.$inferSelect;

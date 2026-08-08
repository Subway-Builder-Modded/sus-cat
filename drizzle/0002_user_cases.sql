ALTER TABLE "guild_settings" ADD COLUMN "bot_admin_role_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Translate generic configuration and feature identities without assuming a
-- server has completed the new setup review.
UPDATE "guild_modules"
SET "config" = ("config" - 'modLogChannelId' - 'staffRoleIds' - 'dmUsers' - 'reasonPresets') || jsonb_build_object(
  'moderationLogChannelId', "config"->'modLogChannelId',
  'moderatorRoleIds', COALESCE("config"->'staffRoleIds', '[]'::jsonb),
  'auditScope', 'moderation',
  'caseCategoryId', NULL,
  'purgeScanLimit', 1000
)
WHERE "module_id" = 'moderation';

INSERT INTO "guild_features" ("guild_id", "module_id", "feature_id", "enabled", "config", "updated_at")
SELECT "guild_id", "module_id",
  CASE "feature_id"
    WHEN 'case-management' THEN 'cases'
    WHEN 'user-dms' THEN 'user-notifications'
    WHEN 'logs' THEN 'moderation-log'
    WHEN 'audit' THEN 'audit-log'
    ELSE "feature_id"
  END,
  "enabled", "config", "updated_at"
FROM "guild_features"
WHERE "module_id" = 'moderation' AND "feature_id" IN ('case-management','user-dms','logs','audit')
ON CONFLICT ("guild_id", "module_id", "feature_id") DO UPDATE SET "enabled" = excluded."enabled", "config" = excluded."config", "updated_at" = excluded."updated_at";

DELETE FROM "guild_features" WHERE "module_id" = 'moderation' AND "feature_id" IN (
  'case-management','user-dms','logs','audit','notes','temporary-bans','softbans','case-buttons'
);

ALTER TABLE "moderation_cases" RENAME TO "moderation_cases_legacy";
ALTER TABLE "moderation_case_revisions" RENAME TO "moderation_case_revisions_legacy";
ALTER TABLE "moderation_evidence" RENAME TO "moderation_evidence_legacy";
ALTER TABLE "moderation_notes" RENAME TO "moderation_notes_legacy";
ALTER TABLE "moderation_note_revisions" RENAME TO "moderation_note_revisions_legacy";
ALTER TABLE "moderation_audit_events" RENAME TO "moderation_audit_events_legacy";
ALTER INDEX "moderation_evidence_case_idx" RENAME TO "moderation_evidence_case_legacy_idx";
ALTER INDEX "moderation_audit_guild_idx" RENAME TO "moderation_audit_guild_legacy_idx";

CREATE TYPE "moderation_entry_action" AS ENUM ('manual','warn','timeout','untimeout','kick','ban','unban','create_channel','legacy_note','legacy_softban','legacy_automated');
CREATE TYPE "moderation_evidence_result" AS ENUM ('none','warn','timeout','kick','ban','unban','untimeout');

CREATE TABLE "moderation_user_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "guild_id" varchar(20) NOT NULL, "case_number" integer NOT NULL,
  "target_user_id" varchar(20) NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "moderation_user_cases_guild_target_unique" ON "moderation_user_cases" ("guild_id","target_user_id");
CREATE UNIQUE INDEX "moderation_user_cases_guild_number_unique" ON "moderation_user_cases" ("guild_id","case_number");
CREATE INDEX "moderation_user_cases_target_idx" ON "moderation_user_cases" ("guild_id","target_user_id");

CREATE TABLE "moderation_custom_case_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "guild_id" varchar(20) NOT NULL, "name" varchar(80) NOT NULL,
  "normalized_name" varchar(80) NOT NULL, "color" integer NOT NULL, "emoji" varchar(100) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "deleted_at" timestamptz
);
CREATE UNIQUE INDEX "moderation_custom_types_name_unique" ON "moderation_custom_case_types" ("guild_id","normalized_name") WHERE "deleted_at" IS NULL;
CREATE INDEX "moderation_custom_types_guild_idx" ON "moderation_custom_case_types" ("guild_id","deleted_at");
CREATE TABLE "moderation_custom_case_type_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "guild_id" varchar(20) NOT NULL,
  "custom_type_id" uuid NOT NULL REFERENCES "moderation_custom_case_types"("id") ON DELETE CASCADE,
  "alias" varchar(80) NOT NULL, "normalized_alias" varchar(80) NOT NULL
);
CREATE UNIQUE INDEX "moderation_custom_alias_guild_unique" ON "moderation_custom_case_type_aliases" ("guild_id","normalized_alias");
CREATE INDEX "moderation_custom_alias_type_idx" ON "moderation_custom_case_type_aliases" ("custom_type_id");

CREATE TABLE "moderation_case_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "case_id" uuid NOT NULL REFERENCES "moderation_user_cases"("id") ON DELETE CASCADE,
  "guild_id" varchar(20) NOT NULL, "actor_id" varchar(20) NOT NULL, "action" moderation_entry_action NOT NULL,
  "custom_type_id" uuid REFERENCES "moderation_custom_case_types"("id") ON DELETE SET NULL, "custom_type_name" varchar(80),
  "custom_type_color" integer, "custom_type_emoji" varchar(100), "reason" text, "duration_ms" integer,
  "metadata" jsonb NOT NULL DEFAULT '{}', "idempotency_key" varchar(100) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "moderation_case_entries_idempotency_unique" ON "moderation_case_entries" ("guild_id","idempotency_key");
CREATE INDEX "moderation_case_entries_timeline_idx" ON "moderation_case_entries" ("case_id","created_at");
CREATE INDEX "moderation_case_entries_action_idx" ON "moderation_case_entries" ("guild_id","action","created_at");

CREATE TABLE "moderation_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "case_id" uuid NOT NULL REFERENCES "moderation_user_cases"("id") ON DELETE CASCADE,
  "case_entry_id" uuid REFERENCES "moderation_case_entries"("id") ON DELETE SET NULL, "guild_id" varchar(20) NOT NULL,
  "added_by_id" varchar(20) NOT NULL, "evidence" text NOT NULL, "description" text,
  "result" moderation_evidence_result NOT NULL DEFAULT 'none', "metadata" jsonb NOT NULL DEFAULT '{}',
  "idempotency_key" varchar(100) NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "moderation_evidence_idempotency_unique" ON "moderation_evidence" ("guild_id","idempotency_key");
CREATE INDEX "moderation_evidence_case_idx" ON "moderation_evidence" ("case_id","created_at");
CREATE INDEX "moderation_evidence_entry_idx" ON "moderation_evidence" ("case_entry_id");

CREATE TABLE "moderation_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "event_type" varchar(80) NOT NULL, "guild_id" varchar(20) NOT NULL,
  "actor_id" varchar(20) NOT NULL, "target_user_id" varchar(20), "case_id" uuid, "case_entry_id" uuid,
  "source_event_id" varchar(100), "before_value" jsonb, "after_value" jsonb, "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "moderation_audit_guild_idx" ON "moderation_audit_events" ("guild_id","created_at");
CREATE UNIQUE INDEX "moderation_audit_source_unique" ON "moderation_audit_events" ("guild_id","source_event_id");

-- Action idempotency is operational state, not an audit record. Keeping it in
-- a separate table means disabling Audit Log truly disables audit writes.
CREATE TABLE "moderation_action_receipts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "guild_id" varchar(20) NOT NULL,
  "idempotency_key" varchar(100) NOT NULL, "action" varchar(40) NOT NULL,
  "actor_id" varchar(20) NOT NULL, "target_user_id" varchar(20), "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "moderation_action_receipts_key_unique" ON "moderation_action_receipts" ("guild_id","idempotency_key");
CREATE INDEX "moderation_action_receipts_guild_idx" ON "moderation_action_receipts" ("guild_id","created_at");

-- One durable case per guild/user. The oldest/lowest legacy case number is
-- retained, along with the first and latest timestamps for that user's history.
INSERT INTO "moderation_user_cases" ("guild_id","case_number","target_user_id","created_at","updated_at")
SELECT "guild_id", MIN("case_number"), "target_user_id", MIN("created_at"), MAX("updated_at")
FROM "moderation_cases_legacy" GROUP BY "guild_id","target_user_id";

-- Notes for users who never had an action case still receive a user case after
-- the highest retained number in that guild.
WITH missing AS (
  SELECT n."guild_id", n."target_user_id", MIN(n."created_at") AS created_at, MAX(n."updated_at") AS updated_at
  FROM "moderation_notes_legacy" n
  LEFT JOIN "moderation_user_cases" c ON c."guild_id" = n."guild_id" AND c."target_user_id" = n."target_user_id"
  WHERE c."id" IS NULL GROUP BY n."guild_id", n."target_user_id"
), numbered AS (
  SELECT missing.*, COALESCE((SELECT MAX(c."case_number") FROM "moderation_user_cases" c WHERE c."guild_id" = missing."guild_id"), 0)
    + ROW_NUMBER() OVER (PARTITION BY missing."guild_id" ORDER BY missing.created_at, missing."target_user_id") AS case_number
  FROM missing
)
INSERT INTO "moderation_user_cases" ("guild_id","case_number","target_user_id","created_at","updated_at")
SELECT "guild_id", "case_number", "target_user_id", "created_at", "updated_at" FROM numbered;

INSERT INTO "moderation_case_entries" (
  "id","case_id","guild_id","actor_id","action","reason","duration_ms","metadata","idempotency_key","created_at","updated_at"
)
SELECT legacy."id", user_case."id", legacy."guild_id", legacy."actor_id",
  CASE
    WHEN legacy."action"::text = 'note' THEN 'legacy_note'::moderation_entry_action
    WHEN legacy."action"::text = 'softban' THEN 'legacy_softban'::moderation_entry_action
    WHEN legacy."action"::text = 'automated' OR legacy."automated" THEN 'legacy_automated'::moderation_entry_action
    WHEN legacy."action"::text = 'nick' THEN 'manual'::moderation_entry_action
    ELSE legacy."action"::text::moderation_entry_action
  END,
  legacy."reason", legacy."duration_ms",
  legacy."audit_metadata" || jsonb_strip_nulls(jsonb_build_object(
    'legacyAction', legacy."action"::text, 'legacyStatus', legacy."status"::text, 'legacyAutomated', legacy."automated",
    'expiresAt', legacy."expires_at", 'internalNote', legacy."internal_note", 'sourceChannelId', legacy."source_channel_id",
    'sourceMessageId', legacy."source_message_id", 'sourceUrl', legacy."source_url", 'relatedLegacyCaseId', legacy."related_case_id",
    'revisions', (SELECT jsonb_agg(jsonb_build_object('actorId', r."actor_id", 'field', r."field", 'before', r."previous_value", 'after', r."next_value", 'at', r."created_at") ORDER BY r."created_at") FROM "moderation_case_revisions_legacy" r WHERE r."case_id" = legacy."id")
  )),
  'legacy-case:' || legacy."id"::text, legacy."created_at", legacy."updated_at"
FROM "moderation_cases_legacy" legacy
JOIN "moderation_user_cases" user_case ON user_case."guild_id" = legacy."guild_id" AND user_case."target_user_id" = legacy."target_user_id";

INSERT INTO "moderation_case_entries" ("id","case_id","guild_id","actor_id","action","reason","metadata","idempotency_key","created_at","updated_at")
SELECT note."id", user_case."id", note."guild_id", note."author_id", 'legacy_note', note."content",
  jsonb_build_object('legacyNote', true, 'legacyCaseId', note."case_id", 'revisions', (SELECT jsonb_agg(jsonb_build_object('actorId', r."actor_id", 'before', r."previous_content", 'after', r."next_content", 'at', r."created_at") ORDER BY r."created_at") FROM "moderation_note_revisions_legacy" r WHERE r."note_id" = note."id")),
  'legacy-note:' || note."id"::text, note."created_at", note."updated_at"
FROM "moderation_notes_legacy" note
JOIN "moderation_user_cases" user_case ON user_case."guild_id" = note."guild_id" AND user_case."target_user_id" = note."target_user_id"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "moderation_evidence" ("id","case_id","case_entry_id","guild_id","added_by_id","evidence","description","result","metadata","idempotency_key","created_at","updated_at")
SELECT evidence."id", user_case."id", legacy."id", evidence."guild_id", evidence."added_by_id", evidence."source", evidence."description", 'none',
  evidence."metadata" || jsonb_build_object('legacyEvidenceType', evidence."type"::text), 'legacy-evidence:' || evidence."id"::text, evidence."created_at", evidence."created_at"
FROM "moderation_evidence_legacy" evidence
JOIN "moderation_cases_legacy" legacy ON legacy."id" = evidence."case_id"
JOIN "moderation_user_cases" user_case ON user_case."guild_id" = legacy."guild_id" AND user_case."target_user_id" = legacy."target_user_id";

INSERT INTO "moderation_audit_events" ("id","event_type","guild_id","actor_id","target_user_id","case_id","case_entry_id","before_value","after_value","metadata","created_at")
SELECT audit."id", audit."event_type", audit."guild_id", audit."actor_id", audit."target_user_id", user_case."id", legacy."id",
  audit."before_value", audit."after_value", audit."metadata" || jsonb_build_object('legacyAudit', true), audit."created_at"
FROM "moderation_audit_events_legacy" audit
LEFT JOIN "moderation_cases_legacy" legacy ON legacy."id" = audit."case_id"
LEFT JOIN "moderation_user_cases" user_case ON user_case."guild_id" = legacy."guild_id" AND user_case."target_user_id" = legacy."target_user_id";

INSERT INTO "moderation_guild_case_counters" ("guild_id","next_case_number")
SELECT "guild_id", MAX("case_number") + 1 FROM "moderation_user_cases" GROUP BY "guild_id"
ON CONFLICT ("guild_id") DO UPDATE SET "next_case_number" = excluded."next_case_number";

-- Removed automation is deliberately not migrated as executable work.
DROP TABLE "moderation_dm_attempts";
DROP TABLE "moderation_scheduled_actions";
DROP TABLE "moderation_note_revisions_legacy";
DROP TABLE "moderation_notes_legacy";
DROP TABLE "moderation_evidence_legacy";
DROP TABLE "moderation_case_revisions_legacy";
DROP TABLE "moderation_audit_events_legacy";
DROP TABLE "moderation_cases_legacy";
DROP TABLE "moderation_configs";
DROP TYPE "moderation_action";
DROP TYPE "moderation_case_status";
DROP TYPE "moderation_evidence_type";
DROP TYPE "moderation_dm_status";
DROP TYPE "moderation_scheduled_status";

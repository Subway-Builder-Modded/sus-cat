CREATE TYPE "moderation_action" AS ENUM ('warn','note','timeout','untimeout','kick','ban','unban','softban','nick','manual','automated');
CREATE TYPE "moderation_case_status" AS ENUM ('pending','active','expired','reversed','voided','superseded','failed');
CREATE TYPE "moderation_evidence_type" AS ENUM ('message','note','attachment','url');
CREATE TYPE "moderation_dm_status" AS ENUM ('sent','failed','disabled');
CREATE TYPE "moderation_scheduled_status" AS ENUM ('pending','processing','completed','failed');

CREATE TABLE "moderation_guild_case_counters" ("guild_id" varchar(20) PRIMARY KEY, "next_case_number" integer NOT NULL DEFAULT 1);
CREATE TABLE "moderation_cases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "case_number" integer NOT NULL, "guild_id" varchar(20) NOT NULL,
  "target_user_id" varchar(20) NOT NULL, "actor_id" varchar(20) NOT NULL, "action" moderation_action NOT NULL,
  "reason" text NOT NULL, "internal_note" text, "duration_ms" integer, "expires_at" timestamptz,
  "status" moderation_case_status NOT NULL DEFAULT 'pending', "automated" boolean NOT NULL DEFAULT false,
  "related_case_id" uuid REFERENCES "moderation_cases"("id"), "source_channel_id" varchar(20), "source_message_id" varchar(20), "source_url" text,
  "dm_delivery_status" moderation_dm_status, "idempotency_key" varchar(100) NOT NULL, "audit_metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "moderation_cases_guild_number_unique" ON "moderation_cases" ("guild_id","case_number");
CREATE UNIQUE INDEX "moderation_cases_idempotency_unique" ON "moderation_cases" ("guild_id","idempotency_key");
CREATE INDEX "moderation_cases_target_history_idx" ON "moderation_cases" ("guild_id","target_user_id","created_at");
CREATE INDEX "moderation_cases_status_expiration_idx" ON "moderation_cases" ("status","expires_at");
CREATE INDEX "moderation_cases_actor_idx" ON "moderation_cases" ("guild_id","actor_id");
CREATE TABLE "moderation_case_revisions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "case_id" uuid NOT NULL REFERENCES "moderation_cases"("id"), "actor_id" varchar(20) NOT NULL, "field" varchar(40) NOT NULL, "previous_value" text, "next_value" text, "created_at" timestamptz NOT NULL DEFAULT now());
CREATE INDEX "moderation_case_revisions_case_idx" ON "moderation_case_revisions" ("case_id","created_at");
CREATE TABLE "moderation_evidence" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "case_id" uuid NOT NULL REFERENCES "moderation_cases"("id"), "guild_id" varchar(20) NOT NULL, "added_by_id" varchar(20) NOT NULL, "type" moderation_evidence_type NOT NULL, "source" text NOT NULL, "description" text, "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" timestamptz NOT NULL DEFAULT now());
CREATE INDEX "moderation_evidence_case_idx" ON "moderation_evidence" ("case_id","created_at");
CREATE TABLE "moderation_notes" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "guild_id" varchar(20) NOT NULL, "target_user_id" varchar(20) NOT NULL, "author_id" varchar(20) NOT NULL, "case_id" uuid REFERENCES "moderation_cases"("id"), "content" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now());
CREATE INDEX "moderation_notes_target_idx" ON "moderation_notes" ("guild_id","target_user_id","created_at");
CREATE TABLE "moderation_note_revisions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "note_id" uuid NOT NULL REFERENCES "moderation_notes"("id"), "actor_id" varchar(20) NOT NULL, "previous_content" text NOT NULL, "next_content" text NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "moderation_audit_events" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "event_type" varchar(80) NOT NULL, "guild_id" varchar(20) NOT NULL, "actor_id" varchar(20) NOT NULL, "target_user_id" varchar(20), "case_id" uuid REFERENCES "moderation_cases"("id"), "before_value" jsonb, "after_value" jsonb, "metadata" jsonb NOT NULL DEFAULT '{}', "created_at" timestamptz NOT NULL DEFAULT now());
CREATE INDEX "moderation_audit_guild_idx" ON "moderation_audit_events" ("guild_id","created_at");
CREATE TABLE "moderation_configs" ("guild_id" varchar(20) PRIMARY KEY, "mod_log_channel_id" varchar(20), "audit_log_channel_id" varchar(20), "dm_users" boolean NOT NULL DEFAULT true, "rules_url" text, "purge_confirmation_threshold" integer NOT NULL DEFAULT 25, "staff_role_ids" jsonb NOT NULL DEFAULT '[]', "reason_presets" jsonb NOT NULL DEFAULT '["Spam","Harassment","Advertising","Inappropriate content","Rule evasion","Staff discretion"]', "notes_enabled" boolean NOT NULL DEFAULT true, "temporary_bans_enabled" boolean NOT NULL DEFAULT true, "case_buttons_enabled" boolean NOT NULL DEFAULT true, "updated_at" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "moderation_lock_states" ("channel_id" varchar(20) PRIMARY KEY, "guild_id" varchar(20) NOT NULL, "actor_id" varchar(20) NOT NULL, "previous_send_messages" boolean, "reason" text, "created_at" timestamptz NOT NULL DEFAULT now());
CREATE TABLE "moderation_scheduled_actions" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "guild_id" varchar(20) NOT NULL, "target_user_id" varchar(20) NOT NULL, "case_id" uuid NOT NULL REFERENCES "moderation_cases"("id"), "action" varchar(40) NOT NULL, "execute_at" timestamptz NOT NULL, "status" moderation_scheduled_status NOT NULL DEFAULT 'pending', "attempts" integer NOT NULL DEFAULT 0, "last_error" text, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now());
CREATE INDEX "moderation_scheduled_due_idx" ON "moderation_scheduled_actions" ("status","execute_at");
CREATE UNIQUE INDEX "moderation_scheduled_case_action_unique" ON "moderation_scheduled_actions" ("case_id","action");
CREATE TABLE "moderation_dm_attempts" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid(), "case_id" uuid NOT NULL REFERENCES "moderation_cases"("id"), "status" moderation_dm_status NOT NULL, "error_code" varchar(80), "created_at" timestamptz NOT NULL DEFAULT now());

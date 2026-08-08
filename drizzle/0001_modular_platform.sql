CREATE TYPE "guild_setup_status" AS ENUM ('unconfigured', 'configuring', 'configured');

CREATE TABLE "guild_settings" (
  "guild_id" varchar(20) PRIMARY KEY,
  "setup_status" guild_setup_status NOT NULL DEFAULT 'unconfigured',
  "setup_version" integer NOT NULL DEFAULT 1,
  "setup_completed_at" timestamptz,
  "setup_completed_by" varchar(20),
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "guild_modules" (
  "guild_id" varchar(20) NOT NULL,
  "module_id" varchar(64) NOT NULL,
  "enabled" boolean NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "guild_modules_identity" ON "guild_modules" ("guild_id", "module_id");

CREATE TABLE "guild_features" (
  "guild_id" varchar(20) NOT NULL,
  "module_id" varchar(64) NOT NULL,
  "feature_id" varchar(64) NOT NULL,
  "enabled" boolean NOT NULL,
  "config" jsonb NOT NULL DEFAULT '{}',
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "guild_features_identity" ON "guild_features" ("guild_id", "module_id", "feature_id");

CREATE TABLE "configuration_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "guild_id" varchar(20) NOT NULL,
  "actor_id" varchar(20) NOT NULL,
  "module_id" varchar(64) NOT NULL,
  "feature_id" varchar(64),
  "key" varchar(100) NOT NULL,
  "before_value" jsonb,
  "after_value" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "configuration_audit_guild_idx" ON "configuration_audit_events" ("guild_id", "created_at");

-- Preserve and translate legacy moderation configuration. Existing guilds are
-- intentionally left unconfigured because the old row cannot prove setup was
-- completed or that referenced channels still exist and are writable.
INSERT INTO "guild_settings" ("guild_id", "setup_status", "updated_at")
SELECT "guild_id", 'unconfigured', "updated_at" FROM "moderation_configs"
ON CONFLICT ("guild_id") DO NOTHING;

INSERT INTO "guild_modules" ("guild_id", "module_id", "enabled", "config", "updated_at")
SELECT "guild_id", 'moderation', true,
  jsonb_build_object(
    'modLogChannelId', "mod_log_channel_id",
    'auditLogChannelId', "audit_log_channel_id",
    'dmUsers', "dm_users",
    'rulesUrl', "rules_url",
    'purgeConfirmationThreshold', "purge_confirmation_threshold",
    'staffRoleIds', "staff_role_ids",
    'reasonPresets', "reason_presets"
  ), "updated_at"
FROM "moderation_configs"
ON CONFLICT ("guild_id", "module_id") DO NOTHING;

INSERT INTO "guild_features" ("guild_id", "module_id", "feature_id", "enabled")
SELECT "guild_id", 'moderation', feature.id, feature.enabled
FROM "moderation_configs"
CROSS JOIN LATERAL (VALUES
  ('notes', "notes_enabled"),
  ('temporary-bans', "temporary_bans_enabled"),
  ('case-buttons', "case_buttons_enabled")
) AS feature(id, enabled)
ON CONFLICT ("guild_id", "module_id", "feature_id") DO NOTHING;

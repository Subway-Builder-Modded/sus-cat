-- Collapse the former Moderation Log and Audit Log destinations into one
-- Audit Log feature, preserving whichever configured channel is available.
UPDATE "guild_modules"
SET "config" = ("config" - 'moderationLogChannelId') || jsonb_build_object(
  'auditLogChannelId', COALESCE(
    NULLIF("config"->'auditLogChannelId', 'null'::jsonb),
    NULLIF("config"->'moderationLogChannelId', 'null'::jsonb),
    'null'::jsonb
  )
)
WHERE "module_id" = 'moderation';

-- If either legacy log switch was enabled, keep the unified Audit Log enabled.
WITH merged AS (
  SELECT "guild_id", "module_id", bool_or("enabled") AS "enabled",
    (array_agg("config" ORDER BY CASE WHEN "feature_id" = 'audit-log' THEN 0 ELSE 1 END, "updated_at" DESC))[1] AS "config",
    max("updated_at") AS "updated_at"
  FROM "guild_features"
  WHERE "module_id" = 'moderation' AND "feature_id" IN ('audit-log', 'moderation-log')
  GROUP BY "guild_id", "module_id"
)
INSERT INTO "guild_features" ("guild_id", "module_id", "feature_id", "enabled", "config", "updated_at")
SELECT "guild_id", "module_id", 'audit-log', "enabled", "config", "updated_at" FROM merged
ON CONFLICT ("guild_id", "module_id", "feature_id") DO UPDATE
SET "enabled" = excluded."enabled", "config" = excluded."config", "updated_at" = excluded."updated_at";

DELETE FROM "guild_features" WHERE "module_id" = 'moderation' AND "feature_id" = 'moderation-log';

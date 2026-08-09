-- New installations require explicit opt-in for destructive, privacy-sensitive,
-- and externally visible moderation features. Preserve the effective behavior
-- of existing module rows before the source defaults change.
INSERT INTO "guild_features" ("guild_id", "module_id", "feature_id", "enabled", "config", "updated_at")
SELECT module."guild_id", module."module_id", feature."feature_id", true, '{}'::jsonb, now()
FROM "guild_modules" module
CROSS JOIN (VALUES
  ('audit-log'),
  ('bans'),
  ('channel-locks'),
  ('evidence'),
  ('kicks'),
  ('nickname'),
  ('purge'),
  ('slowmode'),
  ('sudo'),
  ('timeouts'),
  ('user-notifications')
) AS feature("feature_id")
WHERE module."module_id" = 'moderation'
ON CONFLICT ("guild_id", "module_id", "feature_id") DO NOTHING;

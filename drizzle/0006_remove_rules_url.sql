UPDATE "guild_modules"
SET "config" = "config" - 'rulesUrl',
    "updated_at" = now()
WHERE "module_id" = 'moderation'
  AND "config" ? 'rulesUrl';

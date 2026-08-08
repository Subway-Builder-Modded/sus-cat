# Railway Deployment

Production consists of a GitHub-backed bot service and a PostgreSQL service in the same Railway project. No local bot, Docker, PostgreSQL, or Railway CLI is required.

## First deployment

1. In Railway, create a project and choose **Deploy from GitHub repo**. Authorize GitHub, select this repository, and choose the production branch.
2. Rename the created service if desired. In its **Settings → Deploy**, confirm build command `pnpm build`, pre-deploy command `pnpm env:check && pnpm db:migrate && pnpm register:prod`, start command `pnpm start`, and health path `/healthz`. The checked-in `railway.json` supplies these defaults.
3. From the project canvas choose **New → Database → PostgreSQL**. Keep it as a separate service.
4. Open the bot service, select the production environment, and open **Variables**. Add `DATABASE_URL` as a reference to the database service, normally `${{Postgres.DATABASE_URL}}`; use the actual service name shown by Railway.
5. In the same bot service and same environment add `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`. Optionally add `DISCORD_GUILD_ID` only for development registration. Never put values in Git.
6. Apply/stage the variable changes and deploy. Railway's pre-deploy phase first reports presence-only environment diagnostics, then applies committed Drizzle migrations, then registers commands. A failed validation, migration, or registration prevents the new version from starting.
7. Open **Deployments → latest deployment → View Logs**. Confirm environment validation passed, migration completed, command registration completed, the health server started, the database connection is ready, and the bot connected to Discord.
8. In Discord run `/status`, then `/setup`. Existing legacy guilds must review and finish setup once after migration.

## Future deployments and migrations

Merging to the connected production branch triggers deployment automatically. Migrations are safe to run repeatedly because Drizzle records applied files. Normal bot startup never runs migrations. Review every new SQL migration before merge; destructive resets and `drizzle-kit push` are not part of production.

Railway environments are isolated. A variable visible in Development or Preview does not reach Production. If validation says a variable is missing, open the bot service—not the Postgres service—select the environment named in the log, confirm the reference is on that service, apply staged changes, and redeploy.

## Data protection and recovery

Enable Railway PostgreSQL backups appropriate to the plan, restrict project access, and never expose the public database URL unnecessarily. Before a risky schema migration, create or verify a backup. Moderation history, setup, configuration, audit, scheduled actions, and lock state all live in PostgreSQL.

If application deployment fails, Railway keeps the prior healthy deployment active; fix or roll back the Git commit and redeploy. If migration fails, do not edit the already-applied migration or reset the database. Inspect the migration log, restore from a verified backup if data was changed, create a forward corrective migration, and redeploy. Rotate Discord/database credentials immediately if they are ever exposed.

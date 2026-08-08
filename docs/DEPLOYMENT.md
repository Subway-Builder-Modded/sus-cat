# Deploying to Railway

This is the production deployment path. It uses GitHub as the source, one continuously running Railway bot service, and one Railway PostgreSQL service. Nothing in this procedure requires PostgreSQL, Docker, the bot, or the Railway CLI on a personal computer.

## 1. Connect the GitHub repository

1. Sign in to [Railway](https://railway.com/) using an account connected to GitHub.
2. Create a new project.
3. Choose **Deploy from GitHub repo**, authorize the Railway GitHub App if prompted, and select this repository.
4. Name the resulting service `bot` or another recognizable name.
5. Open the bot service's **Settings** → **Source** area and select the production branch, usually `main`.
6. Ensure automatic deployments are enabled. After CI is added by this repository, enable **Wait for CI** so a failing GitHub check skips deployment.

Railway will use `railway.json` from the repository. Configuration in that file overrides matching dashboard fields.

## 2. Add PostgreSQL

1. On the project canvas, select **+ New** → **Database** → **PostgreSQL**.
2. Wait for the PostgreSQL service to become active.
3. Keep the database and bot in the same Railway project and environment. The bot uses Railway private networking; do not copy the public TCP URL into the bot.

## 3. Configure production variables

Open the bot service → **Variables** and add:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Add a reference variable pointing to the PostgreSQL service's `DATABASE_URL`, normally `${{Postgres.DATABASE_URL}}` when the service is named `Postgres`. Use the dashboard autocomplete rather than typing database credentials. |
| `DISCORD_TOKEN` | The Discord application bot token. Seal this variable after saving it. |
| `DISCORD_CLIENT_ID` | The Discord application ID. |
| `DISCORD_GUILD_ID` | Optional. Set only for a single test guild; omit in production to register commands globally. |

Railway injects `PORT`; do not add it manually. Do not add `PGHOST`, `PGUSER`, `PGPASSWORD`, or other individual PostgreSQL variables to the bot service.

## 4. Verify build and deploy settings

The committed `railway.json` supplies these values:

| Setting | Value |
| --- | --- |
| Build command | `pnpm build` |
| Pre-deploy command | `pnpm db:migrate && pnpm register:prod` |
| Start command | `pnpm start` |
| Healthcheck path | `/healthz` |
| Healthcheck timeout | 120 seconds |
| Restart policy | On failure, up to 10 restarts |
| Draining time | 30 seconds |

Review the deployment details after the first build. Railway should identify the project as Node.js, use pnpm from the `packageManager` field, compile to `dist`, then run the compiled application with Node.js 20 or newer.

Do not attach a volume to the bot service. Its filesystem is intentionally disposable. PostgreSQL owns all durable moderation data.

## 5. Run the initial migration and deploy

1. Confirm `DATABASE_URL`, `DISCORD_TOKEN`, and `DISCORD_CLIENT_ID` exist on the bot service.
2. Review the staged changes in Railway and click **Deploy**. If the initial repository deployment occurred before PostgreSQL or variables were added, choose **Deploy Latest Commit** or redeploy the latest deployment.
3. Railway builds the application.
4. Railway runs `pnpm db:migrate` in its pre-deploy container, over private networking. Drizzle records applied migrations and safely skips them on later deploys.
5. If migration succeeds, Railway runs `pnpm register:prod` to publish application commands.
6. Only after both commands succeed does Railway start `pnpm start`.

A pre-deploy failure exits non-zero and blocks the new release. Migrations are not run in the bot startup path, so a restart cannot unexpectedly execute schema changes.

## 6. Confirm a healthy deployment

Open the bot service → **Deployments** → the newest deployment → **View Logs**. Confirm the logs contain messages equivalent to:

```text
Applying database migrations
Database migrations complete
Loaded 20 command(s)
Database connection ready
Connecting to Discord
Connected as ...
```

The deployment should pass `/healthz`. That endpoint returns HTTP 200 only while PostgreSQL responds and the Discord client is ready. A public Railway domain is not required for the Discord bot.

In Discord, verify the bot appears online and `/mod dashboard` is available. Global application commands can take longer to appear than guild-scoped development commands.

## 7. Future GitHub deployments

Push or merge reviewed changes into the production branch. Railway automatically builds the connected commit. With **Wait for CI** enabled, Railway waits for the repository's typecheck, tests, and production build before deploying.

For every schema change:

1. Commit the generated SQL migration and Drizzle metadata with the code that needs it.
2. Review migration SQL before merging. Destructive changes require an explicit backup and a staged expand/migrate/contract plan; do not hide destructive SQL in startup code.
3. The Railway pre-deploy phase applies pending migrations once. A failure blocks the new deployment and leaves the prior active deployment running.

## 8. Protect moderation data

1. Open the PostgreSQL service → **Backups**.
2. Enable at least daily backups; weekly and monthly schedules can be enabled as additional retention layers.
3. Trigger a manual backup immediately before any destructive or high-risk migration.
4. For stronger recovery objectives, enable Railway's PostgreSQL point-in-time recovery from the same **Backups** tab if available on the selected plan.
5. Never wipe or delete the PostgreSQL volume as part of an application rollback.

Moderation cases, warnings, notes, evidence metadata, scheduled actions, channel lock state, configuration, DM attempts, and audit history all live in PostgreSQL and survive bot deployments.

## 9. Recover from failure

### Build or application failure

Open the bot service's **Deployments** tab, inspect build/deploy logs, and use the three-dot menu on the last known-good deployment to **Rollback** or **Redeploy**. A code rollback restores the old application image and variables; it does not reverse database migrations.

### Migration failure

Do not repeatedly rerun an unknown failing migration and do not edit an already-applied migration. Inspect the pre-deploy logs, fix the migration in a new commit, and deploy that forward fix. The failed release never starts because Railway blocks it at pre-deploy.

If a migration committed bad data rather than merely failing, stop new writes if necessary, restore the PostgreSQL backup or point-in-time recovery fork from the database service's **Backups** tab, validate the restored database, and update the bot's `DATABASE_URL` reference to the recovered PostgreSQL service before redeploying.

## What I need to do in Railway

1. Create a Railway project and connect this GitHub repository.
2. Select the production branch and enable automatic deployments.
3. Add a Railway PostgreSQL service.
4. Add `DATABASE_URL` to the bot as a reference to `${{Postgres.DATABASE_URL}}`.
5. Add and seal `DISCORD_TOKEN`; add `DISCORD_CLIENT_ID`.
6. Review the staged configuration and deploy the latest commit. The Railway pre-deploy command performs the initial migration and command registration.
7. Check logs for database readiness, loaded commands, and the Discord connection message.
8. Enable PostgreSQL backup schedules, then enable **Wait for CI** on the bot service.

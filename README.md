# sus-cat

A modular TypeScript Discord bot with a persistent, Discord-native moderation system.

## Production deployment

Production runs on Railway with PostgreSQL in the same Railway project. No local bot, Docker installation, or local database is required.

Follow [Railway deployment](docs/DEPLOYMENT.md) to connect the GitHub repository, provision PostgreSQL, add the required variables, run migrations inside Railway, and enable automatic production deployments.

Railway reads [railway.json](railway.json) and uses:

- Build: `pnpm build`
- Pre-deploy: `pnpm env:check && pnpm db:migrate && pnpm register:prod`
- Start: `pnpm start`
- Readiness: `/healthz`

## Commands

- `pnpm dev` — run in watch mode.
- `pnpm check` — run the strict TypeScript check.
- `pnpm test` — run the unit tests.
- `pnpm build` / `pnpm start` — compile and run the production build.
- `pnpm register` — register slash and context-menu commands.
- `pnpm db:migrate` — apply committed migrations from a compiled Railway build.
- `pnpm db:migrate:dev` — optional developer-only migration command.
- `pnpm db:generate` — generate a migration after schema changes.
- `pnpm db:studio` — open Drizzle Studio.

## Discord installation

Install the application with the `bot` and `applications.commands` scopes. Grant only the permissions used by enabled workflows:

- View Channels, Send Messages, and Embed Links
- Read Message History and Manage Messages
- Moderate Members
- Kick Members and Ban Members
- Manage Nicknames
- Manage Channels (slowmode and channel locks)

Do not grant Administrator. Place the bot role above every member role it should moderate.

Enable the privileged **Message Content Intent** in the Discord Developer Portal. It is required for content-based purge filters and staff message previews; the bot does not otherwise retain message content by default.

See [Moderation guide](docs/moderation.md) for staff usage, configuration, architecture, and operational notes.

## Project structure

- `src/bot` — client construction and lifecycle.
- `src/commands/definitions` — recursively discovered slash/context commands.
- `src/events/handlers` — recursively discovered Discord events.
- `src/database` and `drizzle` — typed schema and committed migrations.
- `src/moderation` — domain logic, repositories, services, authorization, interactions, and UI.
- `src/shared` — cross-cutting infrastructure.
- `tests` — focused business-logic tests.

Command and event modules are discovered recursively, so nested folders do not require a central registry edit.

# sus-cat

A multi-guild, modular Discord platform built with TypeScript, discord.js, PostgreSQL, and Drizzle ORM. Moderation and interactive documentation are modules; lifecycle, setup, configuration, dispatch, persistence, and shared UI live in the non-disableable core.

## Commands

- `pnpm dev` — optional local watch mode
- `pnpm check` — strict TypeScript validation
- `pnpm test` — unit and architecture tests
- `pnpm build` / `pnpm start` — compile and run production
- `pnpm register` / `pnpm register:prod` — register application commands
- `pnpm db:generate` — generate a Drizzle migration
- `pnpm db:migrate` — apply committed migrations from compiled output
- `pnpm doctor` — non-destructive environment, registry, migration, and optional database checks

Railway builds with `pnpm build`, runs `pnpm env:check && pnpm db:migrate && pnpm register:prod` before deployment, and starts compiled code with `pnpm start`.

## Structure

- `src/core` — bot lifecycle, module/config registries, setup/config UI, dispatch, database, health, logging, and shared UI
- `src/modules/moderation` — moderation commands, interactions, services, repositories, domain, UI, and manifest
- `src/modules/documentation` — manifest-derived in-bot help, navigation, and local search
- `src/scripts` — registration, migrations, environment validation, and doctor
- `drizzle` — append-only production migrations
- `tests` — core architecture and moderation domain tests

Start with [architecture](docs/architecture.md), [development](docs/development.md), or [Railway deployment](docs/deployment.md).

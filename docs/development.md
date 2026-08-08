# Development

Use Node.js 24.14 or newer and pnpm 11. Install with `pnpm install`. Local `.env` and local PostgreSQL are optional developer conveniences; production does not depend on either.

Run `pnpm check`, `pnpm test`, and `pnpm build` before merging. `pnpm doctor` validates environment metadata, module and command definitions, the migration journal, and database connectivity when `DATABASE_URL` is present. It does not mutate the database.

Committed migrations are append-only. Generate changes with `pnpm db:generate`, review the SQL for destructive operations, and never use `drizzle-kit push` against production. Keep commands, events, components, services, repositories, UI, and docs inside their owning module.

Command definitions require an acknowledgement policy. Long operations normally use `defer-ephemeral`; modal launchers use `modal`. Handlers use the shared response helper so deferred responses are edited rather than followed up prematurely.

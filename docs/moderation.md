# Moderation system

## Staff usage

Formal member actions are available through `/warn`, `/timeout`, `/untimeout`, `/kick`, `/ban`, `/unban`, `/softban`, and `/nick`. Serious destructive actions use moderator-bound, single-use confirmation panels. Human-friendly timeout and temporary-ban durations accept values such as `10m`, `2h`, `1d`, and `1w 2d`.

Use `/note` for private staff context. Notes are kept separately from punishment behavior and are only rendered in staff-only interfaces. `/case create` creates a manual staff case without applying a Discord punishment.

Use `/history` for the private paginated member dashboard. `/case view`, `/case edit`, `/case void`, and `/case search` inspect and maintain cases; edits create immutable revision and audit records. Case controls expose evidence, staff notes, history, and reversal only when meaningful.

The user context actions **Moderation History** and **Quick Moderate** open the same dashboards without command memorization. The message context actions **Moderate Message** and **Add Message as Evidence** provide message previews, safe modal-driven actions, source links, and case attachment.

Channel tools are `/purge`, `/slowmode`, `/lock`, and `/unlock`. Purge reports messages skipped because of Discord's 14-day bulk-delete limit. Locks only change the `Send Messages` bit on the everyone overwrite and persist its previous tri-state value for exact restoration.

`/mod dashboard` shows recent activity and configuration health. `/mod active` lists active timeouts and temporary bans. Administrators use the generic `/config` dashboard to manage moderation features, log channels, user DMs, rules links, staff roles, purge thresholds, and case controls. Every change is validated and audited.

## Case lifecycle and auditability

Cases use UUID primary keys and per-guild human case numbers. Numbers are allocated with an atomic PostgreSQL upsert, never `MAX(...) + 1`. An interaction idempotency constraint prevents Discord retries or double clicks from creating duplicate cases.

Discord API operations use a `pending → active` or `pending → failed` lifecycle so partial failures remain visible. Finished punishments are marked expired/reversed/voided rather than deleted. Case edits, evidence, notes, DM attempts, configuration updates, channel actions, and scheduled reversals write persistent audit data.

Temporary bans and timeout case expiration use persisted scheduled actions. The worker checks every 30 seconds, processes overdue actions at startup, reclaims jobs abandoned during a crash, uses PostgreSQL row locking for multi-instance safety, and retries failures up to five times. It does not rely on a punishment-length `setTimeout`.

## Architecture

Discord handlers contain presentation and input extraction only. `ModerationService` and `ChannelModerationService` own business rules and Discord operations. Repositories own every Drizzle query. The centralized capability service combines configured staff roles, Discord permissions, owner/admin status, and target hierarchy checks.

Component IDs use the validated `module:moderation:<action>:<ids>` route format. The core router rechecks setup, module, and feature state before delegating. Ephemeral confirmations store opaque random tokens, expire after two minutes, are bound to the initiating moderator, and are single-use. Persistent case controls contain only stable IDs and re-check guild, capability, hierarchy, and current database state on every click.

User-provided content is sent with mentions disabled. Discord API failures are mapped to safe messages with correlation IDs while structured internal logs retain operational context without tokens, credentials, or evidence content.

## Database operations

Production PostgreSQL is a separate Railway service. The bot receives it through the `DATABASE_URL` reference variable; no individual host, username, password, or public database endpoint is required. Railway runs committed Drizzle migrations in the pre-deploy phase before starting new bot code. See [Railway deployment](deployment.md) for the complete dashboard workflow and backup procedure.

The schema includes cases, per-guild counters, revisions, evidence, notes and note revisions, audit events, guild configuration, lock restoration state, scheduled actions, and DM attempts. Discord snowflakes are stored as strings to avoid numeric precision loss. No persistent moderation state uses Railway's ephemeral application filesystem.

## Operational constraints

- Discord bulk deletion only supports messages newer than 14 days; the bot explicitly reports older matches.
- A purge examines the newest 100 messages because that is Discord's per-request fetch limit.
- Ephemeral destructive confirmation panels intentionally do not survive restarts; no action occurs if one expires. Persistent case/log controls do survive restarts.
- Role hierarchy and Discord permissions can still prevent an otherwise authorized action. The bot never bypasses Discord's enforcement.

## Manual smoke test

1. Deploy to a Railway test environment with `DISCORD_GUILD_ID` set; confirm the Railway pre-deploy migration and command registration succeed.
2. Run `/setup`, enable Moderation, choose its features, and configure log channels and staff roles.
3. Warn a test member and verify the case, DM attempt, dashboard, and mod-log embed.
4. Open **Quick Moderate**, submit a timeout modal, and verify history pagination and active punishments.
5. Start a ban, verify cancel does nothing, then confirm a temporary ban and verify automatic unban/expiration.
6. Right-click a test message, run **Delete + Warn**, and verify deletion, evidence metadata, and case linkage.
7. Edit and void test cases; verify prior values remain in revision/audit tables.
8. Lock and unlock a channel with pre-existing everyone overrides and verify exact `Send Messages` restoration.
9. Purge a test channel above the configured threshold and verify double-click protection and the exact deletion report.

# Moderation system

Moderation is a guild-scoped module made of independently toggleable Bans, Cases, Evidence, Kicks, Nickname, Purge, Slowmode, Sudo, Timeouts, Warnings, User Management, Audit Log, Channel Locks, and User Notifications features. `/moderation config` opens its complete dashboard; `/config` remains the bot-wide entry point.

## Authorization

Ordinary commands accept the command's native Discord permission, a configured Moderator role, a configured Bot Admin role, or owner/Administrator access. Moderator roles are limited to moderation; Bot Admin roles have full bot access. Dynamic role bypass is enforced at runtime, so commands intentionally have no static `default_member_permissions`. The bot's own Discord permission and role hierarchy are separate checks and can never be bypassed.

`/case reset` and `/resetsetup` require owner, Administrator, Manage Server, or Bot Admin access. A Moderator role alone is insufficient. Both use typed confirmation. `/case reset` preserves setup and module configuration; `/resetsetup` invokes module cleanup hooks inside one database transaction and returns the guild to unconfigured state.

## User cases and entries

There is exactly one durable case for each `(guildId, targetUserId)`, even if the user leaves and rejoins. Its guild case number is assigned once with a counter plus a per-user transaction lock. Warnings, timeouts, kicks, bans, unbans, untimeouts, manual records, and private-channel creation append chronological entries. A case has no lifecycle status.

`/case view` opens summary, timeline, evidence, adjacent-case, and user navigation. `/case create` accepts an autocomplete-backed custom type and a separate action. Type classifies the entry; action optionally performs Discord moderation. `/user view`, `/user case`, `/user warns`, `/user timeouts`, `/user kicks`, and `/user bans` are filtered views of the same repository.

Custom types are managed under `/moderation config → Cases → Custom Types`. Names and aliases are case-insensitive and guild-scoped; color uses `#RRGGBB`; emoji accepts Unicode or a valid Discord custom emoji. Deleted types disappear from autocomplete, while entry snapshots keep historical presentation readable.

Evidence is plain content with an optional description, result, and related entry. The case evidence UI supports add, edit, result changes, pagination, and confirmed deletion. The message context action derives the message author's existing case and stores visible content, source link, attachments, and context without an obsolete evidence-type taxonomy.

## Actions and presentation

Ban, kick, timeout, and warn require reasons and support `silent`. Silent actions still execute and write enabled private audit records but create no case/entry and send no DM. Cases and User Notifications are independent: disabling Cases never blocks an action or an enabled DM.

Nickname and slowmode do not create cases, send DMs, or require reasons. Discord manages timeout expiration; the bot has no punishment scheduler, temporary-ban worker, automated punishment system, softban, or staff-note feature.

`/sudo message:<text> [channel]` sends a message through the bot in the selected text channel or thread, defaulting to the current channel. It requires Manage Server, a configured Moderator role, a Bot Admin role, owner, or Administrator access. Discord mentions are deliberately suppressed, the invoking moderator receives a private acknowledgement, and enabled Audit Log records only the destination and resulting message ID—not the message content.

One action presentation map defines labels, unique emoji, colors, past-tense text, and DM wording. It drives moderator result cards, staff logs, timelines, dashboards, and centralized DM notices. User content is always sent with mentions disabled.

## Audit, purge, and operations

Audit Log is the only logging feature and uses one private channel. **Moderation Only** publishes polished bot-action cards and external Discord moderation events. **Full Server Management** includes those events plus meaningful server administration changes. Native Discord audit entries arrive through the gateway, are filtered before database work, deduplicated by entry ID, rendered as human-readable changes, and isolated by guild. Bot-originated native entries are skipped because the bot publishes those actions directly with richer context.

Purge supports current, selected, or all accessible text-channel scope with author, bot, link, attachment, and text filters. Scans and channel traversal are bounded by configuration, significant results receive a preview and single-use confirmation, deletion runs in API-sized batches, and the summary distinguishes deleted, too-old, and failed messages.

Production applies append-only migration `0002_user_cases.sql`. It groups legacy action cases by guild/user, retains the lowest case number, converts actions and notes into entries, migrates evidence and revisions, preserves legacy presentation metadata, resets counters to the next user case, and drops executable scheduled work. Verify a Railway PostgreSQL backup before deployment.

# Styleguide and Principles

This document defines the coding style, architectural rules, data conventions, Discord UX standards, and development principles for `sus-cat`.

These rules exist primarily to keep the bot:

- Modular
- Predictable
- Easy to extend
- Safe in a multi-server environment
- Easy to debug
- Visually consistent
- Resistant to regressions
- Understandable without requiring knowledge of the entire codebase

When a local implementation detail conflicts with these principles, prefer the architecture and conventions described here unless there is a strong technical reason not to.

# Project Architecture

The project is divided into two major layers:

```text
src/
├── core/
├── modules/
│   ├── documentation/
│   ├── moderation/
│   └── ...
├── scripts/
└── index.ts
```

## Core

`src/core/` contains infrastructure required for the bot itself to operate.

Examples:

```text
core/
├── bot/
├── commands/
├── config/
├── database/
├── environment/
├── events/
├── health/
├── interactions/
├── modules/
├── permissions/
├── setup/
├── shared/
└── ui/
```

Core must remain generic.

Core should know:

> Modules can contain commands.

Core should **not** know:

> The Moderation module has a ban command.

Module-specific behavior does not belong in core.

## Modules

Product functionality belongs in:

```text
src/modules/<module>/
```

A substantial module should generally own its:

```text
<module>/
├── commands/
├── config/
├── database/
├── domain/
├── interactions/
├── repositories/
├── services/
├── ui/
├── utils/
├── manifest.ts
└── index.ts
```

Additional feature-specific directories are encouraged where they improve organization:

```text
moderation/
├── audit/
├── cases/
├── evidence/
├── users/
└── ...
```

Do not create empty architectural layers simply to match this structure. A directory should exist because it has a real responsibility.

# Naming Conventions

## Files and Directories

Files and directories use `kebab-case`.

```text
case-service.ts
action-presentation.ts
guild-config-repository.ts
moderation-log.ts
```

Correct:

```text
case-entry-service.ts
```

Incorrect:

```text
CaseEntryService.ts
case_entry_service.ts
caseEntryService.ts
```

Exceptions are conventional project files such as:

```text
README.md
STYLEGUIDE.md
package.json
tsconfig.json
```

## Variables and Functions

Variables and functions use `camelCase`.

```ts
const guildId = interaction.guildId;
const caseNumber = 14;

function buildCaseEmbed() {
  // ...
}

async function loadGuildSettings() {
  // ...
}
```

Do not use PascalCase for ordinary functions.

## Classes, Interfaces, and Types

Classes, interfaces, and type aliases use `PascalCase`.

```ts
class CaseService {
  // ...
}

interface ModuleManifest {
  // ...
}

type ModerationAction = "ban" | "kick" | "timeout";
```

## Boolean Names

Boolean names should read naturally as true/false questions.

Prefer:

```ts
const isEnabled = true;
const hasPermission = false;
const shouldNotifyUser = true;
const canConfigure = false;
```

Avoid:

```ts
const enabledValue = true;
const permission = false;
```

Functions returning booleans should normally use prefixes such as:

```text
is
has
can
should
supports
requires
```

Example:

```ts
function isModuleEnabled() {
  // ...
}

function hasModeratorRole() {
  // ...
}
```

# IDs and Stable Keys

Programmatic IDs use lowercase `kebab-case`.

Examples:

```text
moderation
documentation

case-management
audit-log
user-management
user-notifications
channel-locks
```

IDs are persistent identifiers.

Changing a display name must not require changing the ID.

For example:

```ts
{
  id: "user-management",
  name: "User Management",
}
```

The name may change later.

The ID should generally not.

# Slash Commands

Discord command and option names use lowercase Discord-compatible naming.

```text
/moderation config
/case create
/user warns
/resetsetup
```

Do not expose internal implementation terminology through slash commands.

Prefer:

```text
/nickname
```

over:

```text
/nick-set-member
```

Command names should prioritize clarity for a Discord user rather than matching class names.

# Database Naming

PostgreSQL table and column names use `snake_case`.

```text
moderation_user_cases
moderation_case_entries

guild_id
target_user_id
created_at
```

TypeScript representations use `camelCase`.

```ts
guildId
targetUserId
createdAt
```

Drizzle should perform the mapping explicitly.

# Constants

Normal local immutable values should use `camelCase`.

```ts
const maximumResults = 25;
```

True application-wide constants may use `UPPER_SNAKE_CASE` where this makes their special status clearer.

```ts
const MAX_PURGE_SCAN_MESSAGES = 10_000;
const DISCORD_AUTOCOMPLETE_LIMIT = 25;
```

Do not use uppercase naming merely because a variable was declared with `const`.

# Imports

Use ES modules.

Local TypeScript imports must use the runtime `.js` extension where required by NodeNext.

```ts
import { CaseService } from "./case-service.js";
```

Not:

```ts
import { CaseService } from "./case-service";
```

Group imports approximately as:

```ts
import { EmbedBuilder } from "discord.js";
import { eq } from "drizzle-orm";

import type { BotClient } from "../../core/bot/bot-client.js";
import { respond } from "../../core/interactions/response.js";

import { CaseRepository } from "./case-repository.js";
```

Use blank lines to separate:

1. Third-party dependencies
2. Core/project dependencies
3. Local feature dependencies

Use `import type` when an import is only used as a type.

# Exports

Named exports are preferred.

```ts
export class CaseService {
  // ...
}

export function buildCaseView() {
  // ...
}
```

Use default exports only when an existing loader or framework contract explicitly benefits from them.

Do not create barrel files that merely hide where every symbol originates unless they form an intentional public module API.

# Formatting

TypeScript uses:

- 2 spaces
- No tabs
- Semicolons
- Double quotes
- Trailing commas in multiline structures
- Opening braces on the same line

Correct:

```ts
if (moduleEnabled) {
  await executeModule();
}
```

Incorrect:

```ts
if(moduleEnabled)
{
    await executeModule()
}
```

Operators have spaces around them.

```ts
const total = count + 1;

if (count >= maximum) {
  // ...
}
```

Unary operators do not.

```ts
if (!enabled) {
  return;
}
```

# Control Flow

Prefer guard clauses to deep nesting.

Good:

```ts
if (!interaction.inCachedGuild()) {
  throw new Error("This command is only available in a server.");
}

if (!await settings.isModuleEnabled(guildId, "moderation")) {
  return;
}

await performAction();
```

Avoid:

```ts
if (interaction.inCachedGuild()) {
  if (await settings.isModuleEnabled(guildId, "moderation")) {
    if (hasPermission) {
      await performAction();
    }
  }
}
```

Use braces when doing so improves readability or makes future edits safer.

Short early returns may remain concise:

```ts
if (!value) return;
```

Do not compress substantial business logic into one-line conditionals.

# Ternaries

Ternaries are appropriate for simple value selection.

```ts
const label = enabled ? "Enabled" : "Disabled";
```

Do not use nested ternaries for business logic.

Bad:

```ts
const result = admin
  ? "admin"
  : moderator
    ? "moderator"
    : nativePermission
      ? "native"
      : "denied";
```

Use explicit logic instead.

# Functions

Functions should have one clear purpose.

Good:

```text
validateCaseTypeColor()
createUserCase()
appendCaseEntry()
buildCaseSummaryEmbed()
```

Avoid functions such as:

```text
processEverythingForModeration()
```

If a function requires scrolling through multiple unrelated concepts, split it.

Commands especially should remain thin.

# Comments

Prefer clear names and structure over comments.

Bad:

```ts
// Check if moderation is enabled.
if (moderationEnabled) {
  // ...
}
```

The code already says that.

Comments should primarily explain **why**, constraints, unusual Discord behavior, race conditions, compatibility requirements, or non-obvious design decisions.

Good:

```ts
// Discord command permissions are intentionally enforced at runtime because
// configured Moderator roles can bypass the native user permission requirement.
```

For substantial architectural explanations, use JSDoc or block comments.

```ts
/**
 * Assigns a case number transactionally.
 *
 * A guild may have multiple moderators acting on an unseen user simultaneously,
 * so case creation must rely on the database uniqueness constraint rather than
 * an in-memory existence check.
 */
```

Do not comment every public function simply because it is public.

# TypeScript Type Safety

The project uses strict TypeScript.

Treat type errors as design feedback rather than obstacles to bypass.

Do not introduce:

```ts
any
```

unless interacting with an unavoidable external API boundary and there is no meaningful alternative.

Prefer:

```ts
unknown
```

then narrow it.

```ts
function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }

  return new Error(String(value));
}
```

Avoid:

```ts
function handle(value: any) {
  // ...
}
```

# Optional Values

Do not use non-null assertions to avoid thinking about missing values.

Avoid:

```ts
guild.members.me!
```

Prefer:

```ts
const botMember = guild.members.me ?? await guild.members.fetchMe();
```

If absence is actually impossible by architectural contract, document that contract or encapsulate the assertion in one helper.

# Readonly Data

Use `readonly` for data structures that callers should not mutate.

```ts
interface FeatureDefinition {
  readonly id: string;
  readonly name: string;
  readonly defaultEnabled: boolean;
}
```

Configuration manifests should be treated as immutable definitions.

# Enums and Literal Types

Prefer string literal unions and `as const` objects for most application-domain values.

```ts
const auditScopes = [
  "moderation",
  "full",
] as const;

type AuditScope = (typeof auditScopes)[number];
```

Prefer this over unnecessary TypeScript numeric enums.

Database enums may use Drizzle/PostgreSQL enums when database-level enforcement is useful.

Stable persisted values should be meaningful strings.

Good:

```text
ban
kick
timeout
warning
```

Avoid storing:

```text
0
1
2
3
```

for domain concepts.

# Magic Values

Do not scatter unexplained numbers or strings through the codebase.

Bad:

```ts
if (results.length > 25) {
  // ...
}
```

Good:

```ts
const DISCORD_AUTOCOMPLETE_LIMIT = 25;

if (results.length > DISCORD_AUTOCOMPLETE_LIMIT) {
  // ...
}
```

Constants should communicate *why* a limit exists.

# Domain Types

Use domain-specific types rather than generic strings whenever useful.

Prefer:

```ts
type ModerationAction =
  | "warn"
  | "timeout"
  | "kick"
  | "ban"
  | "unban";
```

over passing arbitrary `string` values throughout moderation services.

At external boundaries, validate unknown strings before converting them into domain types.

# Module Principles

## Modules Own Their Functionality

A module owns its:

- Commands
- Events
- Configuration
- Database schema
- Repositories
- Services
- UI
- Interactions
- Documentation
- Domain types

Moderation functionality should not appear in:

```text
src/core/
```

unless the concept is genuinely reusable by any module.

# Dependency Direction

The dependency direction should generally be:

```text
modules --> core
```

not:

```text
core --> moderation
```

Core exposes contracts.

Modules implement them.

Cross-module dependencies must be explicit and rare.

Do not directly import another module's private repository or service simply because it is convenient.

# Manifest Philosophy

The module manifest is the canonical description of the module.

It should define things such as:

```text
identity
features
configuration
required permissions
dependencies
documentation metadata
```

Do not duplicate this metadata in unrelated files.

If the manifest says:

```ts
{
  id: "bans",
  defaultEnabled: true,
}
```

do not separately maintain another array of known moderation features.

# Feature Flags

Feature flags must affect behavior.

Never implement a feature toggle that only changes the config screen.

If:

```text
Evidence = Disabled
```

then:

- Evidence commands do not operate
- Evidence buttons do not operate
- Evidence controls are hidden where practical
- Moderation actions do not persist evidence
- Background handlers do not process evidence

Configuration must be checked through the central configuration/gating system.

Avoid scattered raw checks such as:

```ts
if (config.evidenceEnabled) {
  // ...
}
```

when a shared feature gate already exists.

# Configuration Philosophy

Modules should be disabled by default unless they are required core functionality.

Within an enabled module, safe and expected features may default on.

Features should default off when they are:

- Destructive
- Unusually broad
- Externally integrated
- Privacy-sensitive
- Expensive
- Surprising to server administrators

Setup must explicitly show what will be enabled.

No important behavior should be hidden behind an invisible default.

# Configuration Definitions

Configuration fields should be declared through typed configuration metadata whenever possible.

Example:

```ts
{
  key: "auditLogChannelId",
  label: "Audit Log Channel",
  type: "channel",
  category: "audit",
  requiredWhen: {
    featureId: "audit-log",
    enabled: true,
  },
}
```

Do not implement a separate custom persistence system for each module.

# Configuration Changes

Configuration changes must:

1. Be validated
2. Be scoped to a guild
3. Be persisted before the UI claims success
4. Be audited
5. Take effect without restarting the bot

Never display:

> Settings updated.

before the transaction actually succeeds.

# Multi-Server Principle

Every guild-owned value must be explicitly scoped by `guildId`.

This includes:

```text
configuration
features
roles
cases
evidence
custom types
audit settings
channels
case counters
user history
```

A repository function such as:

```ts
getCase(targetUserId)
```

is suspicious.

Prefer:

```ts
getCase(guildId, targetUserId)
```

unless guild context is structurally encapsulated elsewhere.

Tests must verify guild isolation for important systems.

# Setup Principles

Setup is a state machine, not a collection of unrelated buttons.

Selection and navigation must remain separate.

Changing a selection updates the selection.

Pressing Continue advances.

Never require the user to change a value just to trigger navigation.

Every setup page should provide clear controls such as:

```text
Back
Continue
Cancel/Exit
```

where appropriate.

Setup screens must be resumable or safely restartable.

# Setup Gating

Before setup is complete, ordinary module functionality must not execute.

The dispatcher should enforce this centrally.

Do not repeat:

```ts
if (!setupComplete) {
  // ...
}
```

inside every command.

The exceptions should be explicitly declared core commands such as:

```text
/setup
/resetsetup
```

where applicable.

# Permission Principles

Authorization must be centralized.

Do not reimplement role/native permission logic in every moderation command.

For normal moderation actions, authorization is generally:

```text
required native Discord user permission
OR Moderator role
OR Bot Admin role
OR Administrator/guild owner where applicable
```

Bot Admin roles have broader bot-wide authority.

Moderator roles only provide moderation authority.

These concepts must remain separate.

The bot itself must still possess whatever Discord permission is required to perform the action.

A user bypass does not bypass Discord's API.

# Static Discord Permissions

Do not use `default_member_permissions` in a way that prevents configured Moderator or Bot Admin roles from accessing commands they should be allowed to use.

Per-guild role overrides are dynamic.

Therefore, most authorization belongs in runtime gating.

# Command Architecture

Command files should primarily:

1. Declare the command
2. Declare requirements
3. Parse inputs
4. Call a service
5. Render a response

They should not contain substantial database/business logic.

Good:

```ts
const result = await moderation.bans.ban({
  guild,
  actor,
  target,
  reason,
  silent,
});

await respond(interaction, buildBanResult(result));
```

Bad:

```ts
// 150 lines of database queries, permission checks, Discord operations,
// case creation, DM generation, and logging inside the command handler.
```

# Command Requirements

Commands should declaratively state requirements using the central command contract.

Examples include:

```text
module
feature
guild-only status
setup requirement
native permission
interaction acknowledgement behavior
```

The dispatcher should enforce these before business logic runs.

# Interaction Acknowledgement

Discord interactions have a response deadline.

Every command must intentionally choose an acknowledgement strategy.

Examples:

```text
defer-ephemeral
defer-public
immediate
modal
```

Long-running commands should normally defer.

Commands that must immediately display a modal must not be pre-deferred.

Never perform potentially slow database/API work before acknowledging an interaction unless the action is guaranteed to remain safely within the interaction deadline.

# Response Handling

Use the shared response helper.

Do not manually reinvent:

```text
reply
editReply
followUp
deferReply
```

semantics inside modules.

For deferred interactions, the initial result should complete the deferred response rather than unnecessarily creating another message.

Response state handling belongs in core.

# Component Routing

Component custom IDs must be generated through the shared routing system.

Do not manually concatenate arbitrary strings across the project.

Conceptually:

```text
module:moderation:evidence:edit:...
```

Custom IDs must never contain:

- Secrets
- Database credentials
- Unrestricted user content
- Large serialized objects

Treat component data as untrusted input.

Always revalidate:

```text
guild
actor
permissions
module state
feature state
resource existence
```

when a component is used.

# Discord UI Principles

The bot should look like one application.

Use shared definitions for:

```text
colors
icons
buttons
navigation
success states
warning states
error states
pagination
empty states
timestamps
user labels
channel labels
role labels
```

Avoid module-specific visual reinventions unless the feature needs a deliberate visual identity.

# Moderation Action Presentation

Moderation action visual identity must be defined centrally.

Example:

```ts
const moderationPresentation = {
  ban: {
    label: "Ban",
    emoji: "🔨",
    color: 0xed4245,
  },
  kick: {
    label: "Kick",
    emoji: "🥾",
    color: 0xf0a34a,
  },
  timeout: {
    label: "Timeout",
    emoji: "⏳",
    color: 0xfee75c,
  },
  warn: {
    label: "Warning",
    emoji: "⚠️",
    color: 0x5865f2,
  },
  nickname: {
    label: "Nickname",
    emoji: "✏️",
    color: 0x9b59b6,
  },
} as const;
```

The exact values may evolve.

The important rule is that the same definition powers:

- Action responses
- DMs
- Case history
- User dashboards
- Moderation logs

Do not hard-code the ban color in five different files.

# Embeds

Embeds should have information hierarchy.

A moderation embed should normally prioritize:

1. What happened
2. Who it affected
3. Why
4. Who performed it
5. Relevant metadata
6. Case/evidence information

Avoid fields that merely repeat the title.

Use target avatars as thumbnails where helpful.

Use the guild icon for server-facing DM notices where helpful.

Do not overload embeds with every possible piece of database metadata.

# Navigation

Interactive pages should provide Back navigation whenever the user can reasonably expect to return to a parent screen.

Pagination should use consistent controls.

Example:

```text
[← Back] [Previous] [2 / 7] [Next]
```

Do not trap users in nested screens.

# Errors

Internal errors and user-facing errors are different concepts.

Internal logs may contain diagnostic details.

Discord users should receive clear, actionable messages.

Bad:

```text
Error: null constraint violation moderation_user_cases_target_idx
```

Good:

```text
I couldn't create the case. No moderation action was recorded.
```

Include an error/reference ID when useful.

Never expose:

- Stack traces
- Database URLs
- Tokens
- Passwords
- Internal SQL

to Discord.

# Services and Repositories

Repositories handle persistence.

Services handle business rules.

Commands and UI handlers orchestrate interaction flow.

Example:

```text
command
  ↓
service
  ↓
repository
  ↓
database
```

Commands should not execute raw Drizzle queries.

UI builders should not execute database queries.

Repositories should not build Discord embeds.

Keep boundaries clear.

# Database Transactions

Use transactions whenever multiple writes represent one logical operation.

Examples:

```text
create case + assign case number
create case + first entry
reset cases
reset setup
edit evidence + audit revision
```

If half of an operation succeeding would produce invalid state, it should normally be transactional.

# Concurrency

Never rely only on:

```ts
if (!await exists()) {
  await create();
}
```

for data that must be unique.

Two Discord interactions can happen simultaneously.

Use:

- Database uniqueness constraints
- Transactions
- Upserts
- Conflict handling
- Retry where appropriate

The database is the final authority.

# Case System Invariants

There is exactly one moderation case per:

```text
guild + user
```

A case is a durable user history container.

Moderation actions are case entries.

Do not create one case per action.

A user who leaves and rejoins retains the same case.

Cases do not have lifecycle statuses such as:

```text
pending
active
expired
```

An individual entry may describe an action and its result, but the user's case itself simply exists.

# Evidence Invariants

Evidence belongs collectively to a user's case.

Evidence may optionally reference a specific case entry.

Evidence contains:

```text
evidence
description?
result
```

Do not reintroduce a required evidence "type".

Evidence must be individually:

```text
viewable
editable
deletable
```

Historical evidence changes should be auditable.

# Silent Moderation

`silent` has one consistent meaning.

For applicable moderation actions:

```text
perform the Discord action
do not create/update a case
do not DM the target
still record the private audit event when audit logging is enabled
```

Do not reinterpret `silent` differently from command to command.

# Moderation Automation

Do not introduce automated moderation punishments unless the architecture and product specification explicitly changes.

The bot should not schedule:

```text
automatic bans
automatic kicks
automatic unbans
automatic punishments
```

Discord-native timeout expiration is fine because Discord owns it.

# Audit Logging

Audit logging must be best-effort but reliable.

Two supported scopes are:

```text
Moderation Only
Full Server Management
```

Audit messages should be human-readable.

Do not dump raw objects or audit-log JSON into Discord.

Bot-generated actions and Discord-native audit events should be correlated where possible to avoid duplicate spam.

`silent` actions remain auditable.

# Idempotency

Any Discord action that can have a meaningful side effect should consider duplicate delivery.

Examples:

```text
ban
kick
timeout
case creation
case entry creation
evidence addition
case channel creation
purge confirmation
```

Interaction IDs should be used as idempotency keys where appropriate.

Repeated delivery must not cause repeated destructive actions.

# Purge Operations

Bulk operations must be bounded.

Never implement an unlimited scan across every channel and every historical message.

Use explicit safety limits.

Use bounded concurrency.

Show accurate previews before large deletion operations.

If Discord rejects a deletion, do not count it as successful.

# Logging

Use structured logs.

Good:

```ts
logger.info("Moderation action completed", {
  guildId,
  actorId,
  targetUserId,
  action: "ban",
  caseNumber,
});
```

Avoid string-only diagnostic blobs where structured fields would be easier to search.

Never log:

```text
DISCORD_TOKEN
DATABASE_URL
passwords
secret values
full environment dumps
```

User-generated message content should only be logged when genuinely necessary.

# Configuration and Secrets

Secrets belong in environment variables.

They do not belong in:

```text
source code
JSON fixtures
test snapshots
logs
Git history
Discord messages
```

`.env` is development-only and must remain ignored.

Production configuration comes from the deployment environment.

# Data Files

Static external project data should generally use JSON unless another format provides a specific advantage.

Do not use JSON as a replacement for relational database tables or typed source definitions merely to avoid designing a schema.

# Database Migration Philosophy

Database compatibility is treated as seriously as API compatibility.

Never edit an already-applied migration to change production history.

Create a new migration.

Prefer:

```text
expand
migrate data
switch application
contract/remove legacy schema
```

for complicated changes.

Destructive schema changes must deliberately account for production data.

Do not solve migration problems with:

```text
DROP DATABASE
```

or instructions to reset production.

# Historical Data

When a feature is redesigned, preserve meaningful historical records whenever practical.

Removing a feature from the product does not automatically mean deleting all historical evidence that it existed.

For example, legacy moderation actions may be migrated into historical case entries even when the corresponding command no longer exists.

# Reset Philosophy

Destructive reset functions must have precisely defined scopes.

`/case reset`:

```text
clears moderation cases/history/evidence
resets numbering
does not clear setup
```

`/resetsetup`:

```text
clears guild setup
clears guild preferences
invokes module reset hooks
clears moderation case history
requires setup again
```

Reset operations should be transactional.

Never leave a guild half-reset.

# Minimal Invasiveness

New functionality should modify the smallest appropriate architectural surface.

Adding a new Moderation evidence editor should primarily affect:

```text
modules/moderation/evidence/
```

It should not require rewriting the command dispatcher.

Adding a new module should primarily require:

```text
src/modules/new-module/
```

plus module registration.

If adding one feature requires changing ten unrelated core files, reconsider the design.

# Isolation Over Giant Files

When functionality grows, isolate it.

Prefer:

```text
audit/
  audit-service.ts
  audit-repository.ts
  audit-event-renderer.ts
  native-audit-listener.ts
```

over:

```text
moderation-service.ts // 2,000 lines
```

There is no fixed maximum line count, but large files are a signal to reconsider responsibilities.

# Reusable Helpers

Extract helpers when logic is genuinely shared.

Good shared logic:

```text
pagination
action presentation
permission resolution
safe replies
component IDs
duration parsing
user labels
channel labels
confirmation screens
```

Do not extract a helper merely because two unrelated lines happen to look similar.

Shared helpers should represent a shared concept.

# Dead Code

Do not commit unused implementations "for later."

The project enables unused-variable and unused-parameter checking.

If code is no longer used, remove it.

If a callback signature requires an unused parameter, prefix it with `_` only when necessary.

```ts
function handleEvent(_client: BotClient, guildId: string) {
  // ...
}
```

Do not accumulate:

```text
old-case-service.ts
new-case-service.ts
new-case-service-2.ts
```

Complete migrations cleanly.

# No Compatibility Zombies

When a system is replaced, there should eventually be one active implementation.

Temporary migration adapters are acceptable while implementing a migration.

They should not become permanent architecture unless documented and necessary.

Do not maintain parallel:

```text
legacy moderation config
new moderation config
```

indefinitely.

# Tests

Tests should describe observable behavior.

Prefer:

```ts
it("reuses the same case when the same user is warned twice", async () => {
  // ...
});
```

over:

```ts
it("test case service 4", async () => {
  // ...
});
```

Tests should especially cover:

- Permission boundaries
- Guild isolation
- Configuration gating
- Database uniqueness
- Concurrency-sensitive operations
- Setup
- Interaction acknowledgement
- Destructive resets
- Migrations
- Module/feature disablement

# Test Layout

Tests should generally mirror the source system they verify.

Example:

```text
tests/
├── core/
│   ├── setup/
│   └── commands/
└── modules/
    └── moderation/
        ├── cases/
        ├── evidence/
        └── permissions/
```

Small focused tests are preferred over one giant integration test file.

# Regression Tests

Every meaningful bug fix should include a regression test when practical.

Examples:

```text
all features selected prevents Continue
required slash option appears after optional option
deferred interaction incorrectly uses followUp
two simultaneous actions create two cases
```

The test should fail before the fix and pass afterward.

# Mocking

Mock external boundaries, not the entire application.

Good boundaries to mock:

```text
Discord REST/API
Discord interactions
clock/time
external integrations
```

Do not mock repositories and services so heavily that tests only verify mocks talking to mocks.

Database behavior involving uniqueness or transactions should preferably be tested against realistic database semantics where practical.

# Discord UX Tests

Where possible, validate structural UI behavior:

```text
Back button exists
Continue remains available
disabled feature hides controls
pagination preserves actor/guild scope
deferred responses are completed
modals are not pre-deferred
```

Do not rely solely on snapshotting huge embed JSON objects.

# Documentation Principles

User-facing documentation is part of the product.

Every significant module or feature should explain:

```text
what it does
who can use it
how to enable it
how to configure it
what permissions it needs
common problems
```

Where possible, documentation should derive metadata from the module manifest rather than manually duplicating it.

# Developer Documentation

Major architectural changes must update relevant developer documentation.

Examples:

```text
docs/architecture.md
docs/modules.md
docs/configuration.md
docs/setup.md
docs/development.md
docs/deployment.md
docs/adding-a-module.md
```

Code and docs should not knowingly describe different architectures.

# New Module Checklist

A new module should generally:

1. Create `src/modules/<module>/`.
2. Define one stable manifest.
3. Define its features and configuration.
4. Declare permissions and dependencies.
5. Keep commands inside the module.
6. Keep persistence inside module repositories.
7. Use core interaction/config/UI infrastructure.
8. Add documentation.
9. Add tests.
10. Register the module through the normal module registry.
11. Pass command validation.
12. Pass `check`, `test`, and `build`.

Adding a module should not require special cases throughout core.

# New Feature Checklist

A new feature inside a module should:

1. Have a stable feature ID.
2. Be declared in the manifest.
3. Define dependencies.
4. Define configuration where required.
5. Be runtime-gated.
6. Hide/disable irrelevant UI when off.
7. Stop event/background behavior when off.
8. Have documentation.
9. Have tests.
10. Avoid duplicating another feature's services.

# Performance Principles

Discord bots are event-driven and multi-server.

Avoid expensive work on every event.

Do not:

```text
load the entire config table
scan every guild
fetch the audit log for every message
perform N+1 queries where one query suffices
spawn uncontrolled Promise.all operations
```

Cache immutable or low-volatility data where useful, but PostgreSQL remains the source of truth.

Caches must be safe to invalidate.

# Concurrency

Use bounded concurrency for operations such as:

```text
cross-channel purge
audit processing
large member/channel operations
```

Do not create thousands of simultaneous Discord REST requests.

Respect Discord rate limits.

# Failure Philosophy

External systems fail.

Discord may reject an action.

A channel may have been deleted.

A role may no longer exist.

A user may leave between command invocation and execution.

The database may temporarily be unavailable.

Code should distinguish between:

```text
invalid user request
missing configuration
missing Discord permission
stale resource
external/API failure
internal bug
```

and respond appropriately.

# Graceful Degradation

Nonessential secondary work should not incorrectly turn a successful primary action into a failure.

Example:

```text
ban succeeds
DM fails
```

The result is:

```text
ban succeeded
notification failed
```

not:

```text
ban failed
```

Likewise, a failed moderation-log send should be reported/logged separately from the actual Discord moderation action.

# Atomicity vs External APIs

A database transaction cannot roll back a Discord ban.

Design multi-step operations accordingly.

Prefer workflows that explicitly record:

```text
attempted
Discord operation result
persistent record result
```

and use idempotency/reconciliation rather than pretending Discord and PostgreSQL form one atomic transaction.

# Security Principles

Never trust data simply because it came from:

```text
a component custom ID
a persisted JSON config
a Discord interaction
an autocomplete value
```

Validate:

```text
guild ownership
resource ownership
actor permission
IDs
feature/module state
configuration values
```

before performing actions.

# User Input

All user-provided text displayed in Discord must respect:

- Discord embed limits
- Message limits
- Safe mentions
- URL validation where applicable
- Custom ID limits
- Database length limits

Never assume a slash-command string is safe simply because Discord provided it.

# Custom Case Types

Custom case type names and aliases are guild-scoped.

Aliases are matched case-insensitively.

Colors must be valid normalized hex colors.

Historical entries must not break if a custom type is later edited or removed.

Persistent historical records should retain enough presentation information to remain understandable.

# Auditability

Administrative changes should be attributable.

Important records should include, where applicable:

```text
guild
actor
target
timestamp
before
after
source
interaction/event ID
```

Do not create audit records whose only useful content is:

```text
Something changed.
```

# Principles

## Clean Before Clever

Prefer boring, understandable TypeScript over clever abstractions.

If a developer has to understand an advanced generic type puzzle to add a moderation feature, the abstraction is probably too complicated.

## Thin Commands, Rich Services

Commands translate Discord input into domain operations.

Services implement behavior.

Repositories persist it.

UI renders it.

Do not merge all four responsibilities into one handler.

## Make Invalid States Difficult

Use:

- Type systems
- Database constraints
- Manifest validation
- Centralized configuration validation
- Transactions

to prevent invalid states instead of repeatedly checking for them after they occur.

## One Source of Truth

Do not maintain multiple definitions of the same information.

Examples:

```text
module feature list --> manifest
action colors --> action presentation registry
guild configuration --> PostgreSQL
command requirements --> command definition
```

If the same list appears in three places, redesign it.

## Explicit Over Magical

Automatic discovery is useful when predictable.

Hidden behavior is not.

A developer should be able to locate:

```text
where a module is registered
where a feature is defined
where a command is gated
where configuration is stored
```

without searching the entire repository.

## Configuration Over Forking

Guild-specific behavior should be represented by configuration, not code branches for specific servers.

Bad:

```ts
if (guild.id === "123456789") {
  // special behavior
}
```

Use configuration.

## Safe Defaults

A missing configuration value should fail closed when proceeding could cause an unsafe or surprising action.

Example:

```text
Audit Log enabled
but no valid Audit Log channel
```

should produce:

```text
Configuration required
```

rather than silently sending somewhere else.

## No Silent Data Loss

Do not silently truncate or discard:

```text
evidence
case history
migration data
audit records
```

because the Discord UI cannot fit it on one page.

Paginate or provide another view.

Storage capability should not be dictated by one embed's limits.

## Preserve History

Historical moderation data is valuable.

Schema redesigns should migrate it whenever reasonably possible.

Feature removal should not casually destroy records.

## UX Is Part of Correctness

A feature is not finished merely because its service works.

It must also be:

```text
discoverable
understandable
navigable
permission-aware
responsive
consistent
```

A setup screen that technically stores settings but traps the user is a broken setup screen.

## Multi-Server First

Never implement a feature as single-server and plan to "make it multi-server later."

Guild isolation is a base invariant.

## Database First for Persistent State

Persistent state belongs in PostgreSQL.

In-memory state may be used for:

```text
short-lived sessions
caches
temporary interaction state
```

but a bot restart must not destroy meaningful configuration or moderation records.

## No Production-Only Mysteries

Behavior should be testable locally wherever practical.

Deployment-specific code must remain isolated.

The application should not contain undocumented assumptions that only Railway happens to satisfy.

## Migrations Are Code

Database migrations receive the same review standards as TypeScript.

They must be:

```text
versioned
reviewable
repeatable
safe for existing data
```

Never treat migration SQL as generated clutter that does not need inspection.

## No Unnecessary Dependencies

Do not add a package for functionality that can be clearly implemented with existing platform APIs in a small amount of code.

When adding a dependency, it should provide meaningful value in correctness, maintainability, security, or developer experience.

## Validate Before Persisting

Bad:

```text
save config
then discover the channel is invalid
```

Good:

```text
validate
persist
refresh UI
```

The database should not knowingly contain impossible configuration.

## Feature Removal Means Removal

When a feature is intentionally removed:

- Remove commands
- Remove config
- Remove runtime services
- Remove event handlers
- Update manifests
- Migrate historical data
- Update docs
- Update tests

Do not simply hide its button.

## Consistency Beats Personal Preference

If several reasonable implementations exist, use the one already established by the project unless there is a concrete reason to improve the pattern.

A coherent codebase is more valuable than each file reflecting its author's favorite style.

# Required Validation

Before code is considered ready, run:

```bash
pnpm check
pnpm test
pnpm build
pnpm run doctor
```

All applicable checks should pass.

Do not merge known type failures or failing tests under the assumption that they can be fixed later.

# Review Checklist

Before completing a meaningful change, review it for:

```text
[ ] Correct module ownership
[ ] No unnecessary core coupling
[ ] Guild isolation
[ ] Runtime feature gating
[ ] Permission handling
[ ] Bot permission handling
[ ] Interaction acknowledgement
[ ] Safe response handling
[ ] Transaction requirements
[ ] Race conditions
[ ] Idempotency
[ ] Discord limits
[ ] Consistent UI
[ ] Back/navigation behavior
[ ] Error handling
[ ] Structured logging
[ ] No secrets
[ ] Migration safety
[ ] Tests
[ ] Documentation
[ ] No dead legacy implementation
```

# Attribution

This styleguide is inspired by the styleguide from the [pokeemerald-expansion](https://github.com/rh-hideout/pokeemerald-expansion) and adapted for the `sus-cat` Discord bot and its TypeScript/module architecture.

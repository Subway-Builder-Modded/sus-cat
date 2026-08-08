# Modules

Modules have stable lowercase IDs and are enabled per guild in `guild_modules`. Features are stored independently in `guild_features`. Defaults come from the manifest only when no explicit row exists.

The registry rejects duplicate module IDs, duplicate feature IDs, missing dependencies, duplicate configuration keys, and invalid `requiredWhen` references. Feature enablement validates dependencies; disabling a dependency disables enabled dependents.

Moderation is disabled by default for a fresh guild and owns all moderation commands, user cases, entries, evidence, custom types, audit state, channel state, services, repositories, UI, permissions, and documentation. No module command, including `/help`, runs before setup completes.

Disabling a module stops commands, module components, and module background work. It does not delete historical data.

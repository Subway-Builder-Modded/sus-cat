# Configuration

Configuration is guild-scoped and stored in PostgreSQL. `guild_settings` tracks setup state; `guild_modules` stores module state and validated JSON configuration; `guild_features` stores feature state; `configuration_audit_events` records every mutation.

Definitions support booleans, strings, integers, channels, roles, URLs, enums, lists, and durations. Each field declares its label, description, default, category, bounds, sensitivity, feature ownership, and conditional requirement. Every applicable field is available during setup and through runtime configuration; persisted JSON is validated whenever it is read.

Fields can belong to a specific feature. Feature-owned fields are hidden and cannot be edited while that feature is disabled. A disabled module exposes only its Enable Module action; enabling the module or feature immediately reveals its applicable settings in `/config` and module-specific dashboards.

Administrators use `/config` to toggle modules/features, edit fields through type-appropriate Discord controls, and inspect recent changes. `/case reset` clears only moderation case state; `/resetsetup` performs the strongly confirmed transactional full reset. Sensitive fields, if added later, are represented as `[REDACTED]` in audit records.

Guild owner, Administrator, Manage Server, and—after initial completion—configured Bot Admin roles can configure. Runtime changes take effect immediately without a restart or command re-registration. Moderator roles do not grant bot-wide configuration access.

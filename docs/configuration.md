# Configuration

Configuration is guild-scoped and stored in PostgreSQL. `guild_settings` tracks setup state; `guild_modules` stores module state and validated JSON configuration; `guild_features` stores feature state; `configuration_audit_events` records every mutation.

Definitions support booleans, strings, integers, channels, roles, URLs, enums, lists, and durations. Each field declares its label, description, default, category, bounds, setup visibility, sensitivity, and conditional requirement. Persisted JSON is validated whenever it is read.

Administrators use `/config` to toggle modules/features, edit fields through type-appropriate Discord controls, inspect recent changes, or reset configuration. Resetting configuration never deletes moderation history. Sensitive fields, if added later, are represented as `[REDACTED]` in audit records.

Guild owner, Administrator, and Manage Server members can configure by default. Runtime changes take effect immediately without a restart or command re-registration.

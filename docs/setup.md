# Initial setup

An unconfigured guild can execute only `/setup`; every other command and component fails closed with setup guidance. Discord may still display globally registered commands, because availability is enforced by the dispatcher rather than per-guild registration.

Initial setup requires the guild owner, Administrator, or Manage Server. After a setup has completed, configured Bot Admin roles can rerun it. The wizard separates selections from navigation: select menus save draft state, while explicit Back and Continue buttons move between Welcome, Bot Admin Roles, Modules, per-module Features, manifest-declared required configuration, permission review, and Finish. Keeping all defaults or selecting no optional features never prevents Continue.

Disabled modules are skipped entirely. Within an enabled module, setup presents every setting owned by enabled features through a complete type-aware picker. Required settings are marked with `*`; disabling Audit Log or another feature removes its settings and validation requirements. Audit Log setup uses one channel and selects either Moderation Only or Full Server Management scope.

Bot Admin roles are core configuration and grant full bot access. Moderator roles are Moderation configuration and bypass only ordinary user-side moderation permissions. Required channels are re-fetched at Finish and checked for View Channel, Send Messages, and Embed Links. Enabled feature bot permissions are reviewed independently.

`/resetsetup` requires destructive administration access and typing the exact server name. Core invokes each module's reset hook in one transaction, removes Bot Admin roles, setup state, module/feature configuration, and module-owned guild data, then requires `/setup` again.

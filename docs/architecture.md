# Architecture

The bot is split into a small, mandatory core and independently configurable product modules.

The core owns process lifecycle, Discord connection, command and component dispatch, module registration, guild setup state, generic configuration, PostgreSQL access, health checks, errors, logging, permissions, and the shared UI language. It never contains moderation-specific decisions.

Each module exports one typed `BotModule`. Its manifest is the canonical source for identity, features, dependencies, configuration fields, capabilities, permissions, commands, and documentation. Commands are collected from registered modules, so global Discord registration remains stable while availability is enforced per guild at runtime.

Interaction flow is:

1. Receive a command or structured component ID.
2. Acknowledge according to explicit command metadata.
3. Enforce guild setup, module, feature, configuration, and bot-permission gates.
4. Invoke the owning handler.
5. Complete deferred responses through the central response helper.
6. Log structured outcome metadata without message contents or secrets.

Module events use the same central Discord listeners. Background jobs must query guild-scoped settings before performing work. No persistent state is stored on the local filesystem or solely in memory.

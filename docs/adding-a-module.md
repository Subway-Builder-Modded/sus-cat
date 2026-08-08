# Adding a Module

1. Create `src/modules/example/manifest.ts` with a unique ID, metadata, feature definitions, configuration fields, and documentation pages.
2. Put commands in `commands/`. Every command declares `moduleId: "example"`, an optional feature, guild/setup requirements, and an acknowledgement policy.
3. Add focused `interactions`, `events`, `services`, `repositories`, `ui`, and `docs` folders only as needed. Use structured IDs from the core component helper.
4. Export a `BotModule` from `index.ts`. Declare `featureForComponent` when components belong to feature switches. Use `configurationView` for a module dashboard and `resetGuild(guildId, tx)` for transactional cleanup when needed.
5. Register the export in `src/modules/index.ts`.
6. Add Drizzle tables only for module-owned durable domain state. Generic settings belong in the existing configuration tables.
7. Add registry, gating, configuration, interaction, and documentation tests. Run `pnpm check`, `pnpm test`, and `pnpm build`.

Minimal manifest:

```ts
export const manifest = {
  id: "example",
  name: "Example",
  description: "A small example module.",
  version: "1.0.0",
  icon: "🧩",
  defaultEnabled: false,
  features: [],
  config: [],
  capabilities: [{ id: "example.view", description: "Use Example." }],
  docs: [],
} as const satisfies ModuleManifest;
```

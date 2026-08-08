import type { ModuleManifest } from "../../core/modules/types.js";

export const documentationManifest = {
  id: "documentation",
  name: "Documentation",
  description: "Interactive setup, command, module, and troubleshooting guidance.",
  version: "1.0.0",
  icon: "📚",
  defaultEnabled: true,
  features: [{ id: "search", name: "Search", description: "Search the local documentation index.", defaultEnabled: true }],
  config: [],
  capabilities: [{ id: "docs.view", description: "View in-bot documentation." }],
  docs: [
    { id: "getting-started", title: "Getting Started", category: "Getting Started", summary: "Set up the bot in a new server.", body: "An administrator runs /setup, chooses modules and features, supplies required channels and roles, reviews the configuration, and finishes setup.", keywords: ["setup", "install", "start"] },
    { id: "configuration", title: "Configuration", category: "Configuration", summary: "Manage modules and settings.", body: "Administrators use /config. Changes are validated, persisted immediately, and recorded in the configuration audit trail.", keywords: ["config", "settings", "modules"] },
    { id: "troubleshooting", title: "Troubleshooting", category: "Troubleshooting", summary: "Resolve common command and permission issues.", body: "If a command is unavailable, check setup status, its module and feature switches, required configuration, and the bot's Discord permissions.", keywords: ["disabled", "permissions", "command"] },
  ],
} as const satisfies ModuleManifest;

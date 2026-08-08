import { describe, expect, it } from "vitest";

import type { BotCommand } from "../src/core/commands/command.js";
import { enforceCommandGate } from "../src/core/commands/dispatcher.js";
import { moderationModule } from "../src/modules/moderation/index.js";

const command = (overrides: Partial<BotCommand["requirements"]> = {}) => ({ requirements: { acknowledgement: "immediate", guildOnly: true, setupRequired: true, moduleId: "moderation", featureId: "warnings", ...overrides } }) as BotCommand;
const interaction = { guildId: "guild", appPermissions: { has: () => true } } as never;
const client = (status: string, moduleEnabled: boolean, featureEnabled: boolean) => ({
  modules: { require: () => moderationModule },
  platform: { settings: { setupStatus: async () => status, isModuleEnabled: async () => moduleEnabled, isFeatureEnabled: async () => featureEnabled, configurationIssues: async () => [] } },
}) as never;

describe("central command gating", () => {
  it("blocks unconfigured guilds", async () => {
    await expect(enforceCommandGate(client("unconfigured", true, true), interaction, command())).rejects.toThrow("not completed setup");
  });
  it("blocks disabled modules and features", async () => {
    await expect(enforceCommandGate(client("configured", false, true), interaction, command())).rejects.toThrow("Moderation is disabled");
    await expect(enforceCommandGate(client("configured", true, false), interaction, command())).rejects.toThrow("Warnings is disabled");
  });
  it("allows setup/core exemptions", async () => {
    await expect(enforceCommandGate(client("unconfigured", false, false), interaction, command({ moduleId: undefined, featureId: undefined, setupRequired: false }))).resolves.toBeUndefined();
  });
});

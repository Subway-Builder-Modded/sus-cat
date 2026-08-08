import { describe, expect, it } from "vitest";

import { GuildConfigService } from "../src/core/config/service.js";
import type { GuildConfigRepository } from "../src/core/config/repository.js";
import { ModuleRegistry } from "../src/core/modules/registry.js";

class MemoryStore {
  readonly setups = new Map<string, "unconfigured" | "configuring" | "configured">();
  readonly modules = new Map<string, { enabled: boolean; config: Record<string, unknown> }>();
  readonly features = new Map<string, { enabled: boolean; config: Record<string, unknown> }>();
  readonly audits: { guildId: string; key: string }[] = [];
  async ensureGuild(guildId: string) { if (!this.setups.has(guildId)) this.setups.set(guildId, "unconfigured"); }
  async setup(guildId: string) { const setupStatus = this.setups.get(guildId); return setupStatus ? { setupStatus, active: true } : undefined; }
  async setSetup(guildId: string, status: "unconfigured" | "configuring" | "configured") { this.setups.set(guildId, status); }
  async module(guildId: string, moduleId: string) { return this.modules.get(`${guildId}:${moduleId}`); }
  async feature(guildId: string, moduleId: string, featureId: string) { return this.features.get(`${guildId}:${moduleId}:${featureId}`); }
  async saveModule(guildId: string, moduleId: string, enabled: boolean, config: Record<string, unknown>) { this.modules.set(`${guildId}:${moduleId}`, { enabled, config }); }
  async saveFeature(guildId: string, moduleId: string, featureId: string, enabled: boolean, config = {}) { this.features.set(`${guildId}:${moduleId}:${featureId}`, { enabled, config }); }
  async audit(guildId: string, _actorId: string, _moduleId: string, key: string) { this.audits.push({ guildId, key }); }
  async clearModule(guildId: string, moduleId: string) {
    this.modules.delete(`${guildId}:${moduleId}`);
    for (const key of this.features.keys()) if (key.startsWith(`${guildId}:${moduleId}:`)) this.features.delete(key);
  }
}

function fixture() {
  const registry = new ModuleRegistry();
  registry.register({ manifest: { id: "sample", name: "Sample", description: "", version: "1", icon: "🧩", defaultEnabled: false, features: [{ id: "base", name: "Base", description: "", defaultEnabled: true }, { id: "child", name: "Child", description: "", defaultEnabled: true, dependencies: ["base"] }], config: [{ key: "channel", label: "Channel", description: "", type: "channel", defaultValue: null, category: "channels", featureId: "base", requiredWhen: { featureId: "base", enabled: true } }], capabilities: [], docs: [] }, commands: [] });
  const store = new MemoryStore();
  return { store, service: new GuildConfigService(store as unknown as GuildConfigRepository, registry) };
}

describe("guild configuration service", () => {
  it("isolates module and feature state by guild", async () => {
    const { service } = fixture();
    await service.setModuleEnabled("guild-a", "sample", true, "actor");
    await service.setFeatureEnabled("guild-a", "sample", "base", false, "actor");
    expect(await service.isModuleEnabled("guild-a", "sample")).toBe(true);
    expect(await service.isModuleEnabled("guild-b", "sample")).toBe(false);
    expect(await service.isFeatureEnabled("guild-a", "sample", "base")).toBe(false);
  });

  it("enforces feature dependencies", async () => {
    const { service } = fixture();
    await service.setModuleEnabled("guild", "sample", true, "actor");
    await service.setFeatureEnabled("guild", "sample", "base", false, "actor");
    await expect(service.setFeatureEnabled("guild", "sample", "child", true, "actor")).rejects.toThrow("requires Base");
  });

  it("exposes feature-owned settings only while their module and feature are enabled", async () => {
    const { service } = fixture();
    expect(await service.isConfigAvailable("guild", "sample", "channel")).toBe(false);
    await service.setModuleEnabled("guild", "sample", true, "actor");
    expect(await service.isConfigAvailable("guild", "sample", "channel")).toBe(true);
    await service.setFeatureEnabled("guild", "sample", "base", false, "actor");
    expect(await service.isConfigAvailable("guild", "sample", "channel")).toBe(false);
    await expect(service.requireConfigAvailable("guild", "sample", "channel")).rejects.toThrow("Enable the module");
    await expect(service.setConfig("guild", "sample", "channel", "12345678901234567", "actor")).rejects.toThrow("Enable the module");
    expect(await service.configurationIssues("guild", "sample")).toEqual([]);
  });

  it("tracks setup state, validates required config, and audits changes", async () => {
    const { service, store } = fixture();
    await service.beginSetup("guild", "actor");
    await service.setModuleEnabled("guild", "sample", true, "actor");
    expect(await service.setupStatus("guild")).toBe("configuring");
    await expect(service.completeSetup("guild", "actor")).rejects.toThrow("Channel is required");
    await service.setConfig("guild", "sample", "channel", "12345678901234567", "actor");
    await service.completeSetup("guild", "actor");
    expect(await service.setupStatus("guild")).toBe("configured");
    expect(store.audits.map((event) => event.key)).toContain("channel");
  });

  it("resets one module without touching another guild", async () => {
    const { service } = fixture();
    await service.setModuleEnabled("guild-a", "sample", true, "actor");
    await service.setModuleEnabled("guild-b", "sample", true, "actor");
    await service.resetModule("guild-a", "sample", "actor");
    expect(await service.isModuleEnabled("guild-a", "sample")).toBe(false);
    expect(await service.isModuleEnabled("guild-b", "sample")).toBe(true);
  });
});

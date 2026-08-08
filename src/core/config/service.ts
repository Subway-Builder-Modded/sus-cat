import type { ConfigValue } from "./definitions.js";
import { defaultConfig } from "./definitions.js";
import type { GuildConfigRepository } from "./repository.js";
import { validateConfigValue } from "./validation.js";
import type { ModuleRegistry } from "../modules/registry.js";

export interface ConfigurationIssue { readonly moduleId: string; readonly key: string; readonly message: string; }

export class GuildConfigService {
  constructor(readonly repository: GuildConfigRepository, readonly modules: ModuleRegistry) {}

  async ensureGuild(guildId: string): Promise<void> { await this.repository.ensureGuild(guildId); }
  async registerGuildJoin(guildId: string, actorId: string): Promise<void> { await this.repository.setSetup(guildId, "unconfigured", actorId); }
  async isGuildActive(guildId: string): Promise<boolean> { return (await this.repository.setup(guildId))?.active ?? false; }
  async setupStatus(guildId: string): Promise<"unconfigured" | "configuring" | "configured"> {
    return (await this.repository.setup(guildId))?.setupStatus ?? "unconfigured";
  }
  async botAdminRoleIds(guildId: string): Promise<string[]> {
    const roles = (await this.repository.setup(guildId))?.botAdminRoleIds;
    return Array.isArray(roles) && roles.every((role) => typeof role === "string") ? roles : [];
  }
  async hasCompletedSetup(guildId: string): Promise<boolean> {
    return Boolean((await this.repository.setup(guildId))?.setupCompletedAt);
  }
  async setBotAdminRoles(guildId: string, roleIds: readonly string[], actorId: string): Promise<void> {
    const before = await this.botAdminRoleIds(guildId);
    await this.repository.setBotAdminRoles(guildId, roleIds);
    await this.repository.audit(guildId, actorId, "core", "botAdminRoleIds", before, roleIds);
  }
  async beginSetup(guildId: string, actorId: string): Promise<void> { await this.repository.setSetup(guildId, "configuring", actorId); }
  async completeSetup(guildId: string, actorId: string): Promise<void> {
    const issues = await this.configurationIssues(guildId);
    if (issues.length) throw new Error(`Configuration is incomplete: ${issues.map((issue) => issue.message).join("; ")}`);
    await this.repository.setSetup(guildId, "configured", actorId);
  }
  async resetModule(guildId: string, moduleId: string, actorId: string): Promise<void> {
    this.modules.require(moduleId);
    await this.repository.clearModule(guildId, moduleId);
    await this.repository.audit(guildId, actorId, moduleId, "module.reset", "custom", "defaults");
  }
  async isModuleEnabled(guildId: string, moduleId: string): Promise<boolean> {
    const module = this.modules.require(moduleId);
    const enabled = (await this.repository.module(guildId, moduleId))?.enabled ?? module.manifest.defaultEnabled;
    if (!enabled) return false;
    for (const dependency of module.manifest.dependencies ?? []) if (!await this.isModuleEnabled(guildId, dependency)) return false;
    return true;
  }
  async setModuleEnabled(guildId: string, moduleId: string, enabled: boolean, actorId: string): Promise<void> {
    const module = this.modules.require(moduleId);
    if (enabled) for (const dependency of module.manifest.dependencies ?? []) if (!await this.isModuleEnabled(guildId, dependency)) throw new Error(`${module.manifest.name} requires ${this.modules.require(dependency).manifest.name}.`);
    const row = await this.repository.module(guildId, moduleId);
    const before = row?.enabled ?? module.manifest.defaultEnabled;
    await this.repository.saveModule(guildId, moduleId, enabled, row?.config ?? defaultConfig(module.manifest.config));
    await this.repository.audit(guildId, actorId, moduleId, "module.enabled", before, enabled);
  }
  async isFeatureEnabled(guildId: string, moduleId: string, featureId: string): Promise<boolean> {
    if (!await this.isModuleEnabled(guildId, moduleId)) return false;
    const feature = this.feature(moduleId, featureId);
    return (await this.repository.feature(guildId, moduleId, featureId))?.enabled ?? feature.defaultEnabled;
  }
  async setFeatureEnabled(guildId: string, moduleId: string, featureId: string, enabled: boolean, actorId: string): Promise<void> {
    const feature = this.feature(moduleId, featureId);
    if (enabled) for (const dependency of feature.dependencies ?? []) if (!await this.isFeatureEnabled(guildId, moduleId, dependency)) throw new Error(`${feature.name} requires ${this.feature(moduleId, dependency).name}.`);
    if (!enabled) {
      const dependents = this.modules.require(moduleId).manifest.features.filter((candidate) => candidate.dependencies?.includes(featureId) && candidate.id !== featureId);
      for (const dependent of dependents) if (await this.isFeatureEnabled(guildId, moduleId, dependent.id)) await this.setFeatureEnabled(guildId, moduleId, dependent.id, false, actorId);
    }
    const before = await this.isFeatureEnabled(guildId, moduleId, featureId);
    await this.repository.saveFeature(guildId, moduleId, featureId, enabled);
    await this.repository.audit(guildId, actorId, moduleId, "feature.enabled", before, enabled, featureId);
  }
  async getModuleConfig(guildId: string, moduleId: string): Promise<Record<string, ConfigValue>> {
    const manifest = this.modules.require(moduleId).manifest;
    const stored = (await this.repository.module(guildId, moduleId))?.config ?? {};
    const result = defaultConfig(manifest.config);
    for (const definition of manifest.config) if (definition.key in stored) result[definition.key] = validateConfigValue(definition, stored[definition.key]);
    return result;
  }
  async setConfig(guildId: string, moduleId: string, key: string, value: unknown, actorId: string): Promise<void> {
    const module = this.modules.require(moduleId);
    const definition = module.manifest.config.find((candidate) => candidate.key === key);
    if (!definition) throw new Error(`Unknown configuration field: ${moduleId}.${key}`);
    const validated = validateConfigValue(definition, value);
    const row = await this.repository.module(guildId, moduleId);
    const config = await this.getModuleConfig(guildId, moduleId);
    const before = config[key] ?? null;
    config[key] = validated;
    await this.repository.saveModule(guildId, moduleId, row?.enabled ?? module.manifest.defaultEnabled, config);
    await this.repository.audit(guildId, actorId, moduleId, key, definition.sensitive ? "[REDACTED]" : before, definition.sensitive ? "[REDACTED]" : validated);
  }
  async configurationIssues(guildId: string, onlyModuleId?: string): Promise<ConfigurationIssue[]> {
    const issues: ConfigurationIssue[] = [];
    for (const module of this.modules.all()) {
      if (onlyModuleId && module.manifest.id !== onlyModuleId) continue;
      if (!await this.isModuleEnabled(guildId, module.manifest.id)) continue;
      const config = await this.getModuleConfig(guildId, module.manifest.id);
      for (const definition of module.manifest.config) {
        const required = definition.required || (definition.requiredWhen && definition.requiredWhen.enabled === await this.isFeatureEnabled(guildId, module.manifest.id, definition.requiredWhen.featureId));
        const value = config[definition.key];
        if (required && (value === null || value === "" || (Array.isArray(value) && value.length === 0))) issues.push({ moduleId: module.manifest.id, key: definition.key, message: `${module.manifest.name}: ${definition.label} is required` });
      }
    }
    return issues;
  }
  private feature(moduleId: string, featureId: string) {
    const feature = this.modules.require(moduleId).manifest.features.find((candidate) => candidate.id === featureId);
    if (!feature) throw new Error(`Unknown feature: ${moduleId}.${featureId}`);
    return feature;
  }
}

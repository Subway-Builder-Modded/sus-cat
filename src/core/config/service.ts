import type { ConfigValue } from "./definitions.js";
import { defaultConfig } from "./definitions.js";
import type { GuildConfigRepository } from "./repository.js";
import { validateConfigValue } from "./validation.js";
import type { ModuleRegistry } from "../modules/registry.js";

export interface ConfigurationIssue { readonly moduleId: string; readonly key: string; readonly message: string; }

export class GuildConfigService {
  constructor(private readonly repository: GuildConfigRepository, private readonly modules: ModuleRegistry) {}

  async ensureGuild(guildId: string): Promise<void> { await this.repository.ensureGuild(guildId); }
  async registerGuildJoin(guildId: string, actorId: string): Promise<void> { await this.repository.setSetup(guildId, "unconfigured", actorId); }
  async markGuildInactive(guildId: string): Promise<void> { await this.repository.markInactive(guildId); }
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
    await this.repository.setBotAdminRoles(guildId, roleIds, actorId);
  }
  async beginSetup(guildId: string, actorId: string): Promise<void> { await this.repository.setSetup(guildId, "configuring", actorId); }
  async completeSetup(guildId: string, actorId: string): Promise<void> {
    const issues = await this.configurationIssues(guildId);
    if (issues.length) throw new Error(`Configuration is incomplete: ${issues.map((issue) => issue.message).join("; ")}`);
    await this.repository.setSetup(guildId, "configured", actorId);
  }
  async resetModule(guildId: string, moduleId: string, actorId: string): Promise<void> {
    this.modules.require(moduleId);
    await this.repository.clearModule(guildId, moduleId, { actorId, key: "module.reset", before: "custom", after: "defaults" });
  }
  async resetGuild(guildId: string): Promise<void> {
    await this.repository.resetGuild(guildId, async (transaction) => {
      for (const module of this.modules.all()) await module.resetGuild?.(guildId, transaction);
    });
  }
  async recentAudit(guildId: string) { return this.repository.recentAudit(guildId); }
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
    await this.repository.saveModule(guildId, moduleId, enabled, defaultConfig(module.manifest.config), actorId, module.manifest.defaultEnabled);
  }
  async setEnabledModules(guildId: string, selectedModuleIds: readonly string[], actorId: string): Promise<void> {
    const selected = new Set(selectedModuleIds);
    const unknown = selectedModuleIds.find((moduleId) => !this.modules.all().some((module) => module.manifest.id === moduleId));
    if (unknown) throw new Error(`Unknown module: ${unknown}`);
    for (const module of this.modules.all()) {
      if (!selected.has(module.manifest.id)) continue;
      const missing = module.manifest.dependencies?.find((dependency) => !selected.has(dependency));
      if (missing) throw new Error(`${module.manifest.name} requires ${this.modules.require(missing).manifest.name}.`);
    }
    const changes = this.modules.all().map((module) => {
      return { moduleId: module.manifest.id, enabled: selected.has(module.manifest.id), fallbackBefore: module.manifest.defaultEnabled, defaultConfig: defaultConfig(module.manifest.config) };
    });
    await this.repository.saveModuleSelection(guildId, changes, actorId);
  }
  async isFeatureEnabled(guildId: string, moduleId: string, featureId: string): Promise<boolean> {
    if (!await this.isModuleEnabled(guildId, moduleId)) return false;
    const feature = this.feature(moduleId, featureId);
    const isEnabled = (await this.repository.feature(guildId, moduleId, featureId))?.enabled ?? feature.defaultEnabled;
    if (!isEnabled) return false;
    for (const dependency of feature.dependencies ?? []) if (!await this.isFeatureEnabled(guildId, moduleId, dependency)) return false;
    return true;
  }
  async setFeatureEnabled(guildId: string, moduleId: string, featureId: string, enabled: boolean, actorId: string): Promise<void> {
    const feature = this.feature(moduleId, featureId);
    const manifest = this.modules.require(moduleId).manifest;
    const selected = new Set<string>();
    for (const candidate of manifest.features) if (await this.isFeatureEnabled(guildId, moduleId, candidate.id)) selected.add(candidate.id);
    if (enabled) {
      for (const dependency of feature.dependencies ?? []) if (!selected.has(dependency)) throw new Error(`${feature.name} requires ${this.feature(moduleId, dependency).name}.`);
      selected.add(featureId);
    } else {
      selected.delete(featureId);
      let changed = true;
      while (changed) {
        changed = false;
        for (const candidate of manifest.features) if (selected.has(candidate.id) && candidate.dependencies?.some((dependency) => !selected.has(dependency))) {
          selected.delete(candidate.id);
          changed = true;
        }
      }
    }
    await this.setEnabledFeatures(guildId, moduleId, [...selected], actorId);
  }
  async setEnabledFeatures(guildId: string, moduleId: string, selectedFeatureIds: readonly string[], actorId: string): Promise<void> {
    if (!await this.isModuleEnabled(guildId, moduleId)) throw new Error("Enable the module before changing its features.");
    const module = this.modules.require(moduleId);
    const selected = new Set(selectedFeatureIds);
    const unknown = selectedFeatureIds.find((featureId) => !module.manifest.features.some((feature) => feature.id === featureId));
    if (unknown) throw new Error(`Unknown feature: ${moduleId}.${unknown}`);
    for (const feature of module.manifest.features) {
      if (!selected.has(feature.id)) continue;
      const missing = feature.dependencies?.find((dependency) => !selected.has(dependency));
      if (missing) throw new Error(`${feature.name} requires ${module.manifest.features.find((item) => item.id === missing)?.name ?? missing}.`);
    }
    const changes = module.manifest.features.map((feature) => ({
      featureId: feature.id,
      enabled: selected.has(feature.id),
      fallbackBefore: feature.defaultEnabled,
    }));
    await this.repository.saveFeatureSelection(guildId, moduleId, changes, actorId);
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
    if (!await this.isConfigAvailable(guildId, moduleId, key)) throw new Error("Enable the module and its related feature before configuring this setting.");
    const validated = validateConfigValue(definition, value);
    const row = await this.repository.module(guildId, moduleId);
    await this.repository.saveConfigValue(guildId, moduleId, row?.enabled ?? module.manifest.defaultEnabled, defaultConfig(module.manifest.config), {
      actorId,
      key,
      value: validated,
      fallbackBefore: definition.defaultValue,
      isSensitive: Boolean(definition.sensitive),
    });
  }
  async isConfigAvailable(guildId: string, moduleId: string, key: string): Promise<boolean> {
    if (!await this.isModuleEnabled(guildId, moduleId)) return false;
    const definition = this.modules.require(moduleId).manifest.config.find((candidate) => candidate.key === key);
    if (!definition) throw new Error(`Unknown configuration field: ${moduleId}.${key}`);
    return !definition.featureId || await this.isFeatureEnabled(guildId, moduleId, definition.featureId);
  }
  async requireConfigAvailable(guildId: string, moduleId: string, key: string): Promise<void> {
    if (!await this.isConfigAvailable(guildId, moduleId, key)) throw new Error("Enable the module and its related feature before configuring this setting.");
  }
  async isConfigRequired(guildId: string, moduleId: string, key: string): Promise<boolean> {
    if (!await this.isConfigAvailable(guildId, moduleId, key)) return false;
    const definition = this.modules.require(moduleId).manifest.config.find((candidate) => candidate.key === key);
    if (!definition) throw new Error(`Unknown configuration field: ${moduleId}.${key}`);
    return Boolean(definition.required || (definition.requiredWhen && definition.requiredWhen.enabled === await this.isFeatureEnabled(guildId, moduleId, definition.requiredWhen.featureId)));
  }
  async configurationIssues(guildId: string, onlyModuleId?: string): Promise<ConfigurationIssue[]> {
    const issues: ConfigurationIssue[] = [];
    for (const module of this.modules.all()) {
      if (onlyModuleId && module.manifest.id !== onlyModuleId) continue;
      if (!await this.isModuleEnabled(guildId, module.manifest.id)) continue;
      const config = await this.getModuleConfig(guildId, module.manifest.id);
      for (const definition of module.manifest.config) {
        if (!await this.isConfigAvailable(guildId, module.manifest.id, definition.key)) continue;
        const required = await this.isConfigRequired(guildId, module.manifest.id, definition.key);
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

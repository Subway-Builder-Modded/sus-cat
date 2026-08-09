import { and, desc, eq } from "drizzle-orm";

import type { Database, DatabaseTransaction } from "../database/client.js";
import { configurationAuditEvents, guildFeatures, guildModules, guildSettings } from "../database/schema.js";

export interface ModuleRow { readonly enabled: boolean; readonly config: Record<string, unknown>; }
export interface FeatureRow { readonly enabled: boolean; readonly config: Record<string, unknown>; }
export interface ConfigChangeAudit {
  readonly actorId: string;
  readonly key: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly featureId?: string;
}
export interface ConfigValueChange {
  readonly actorId: string;
  readonly key: string;
  readonly value: unknown;
  readonly fallbackBefore: unknown;
  readonly isSensitive: boolean;
}
export interface FeatureSelectionChange {
  readonly featureId: string;
  readonly enabled: boolean;
  readonly fallbackBefore: boolean;
}
export interface ModuleSelectionChange {
  readonly moduleId: string;
  readonly enabled: boolean;
  readonly fallbackBefore: boolean;
  readonly defaultConfig: Record<string, unknown>;
}

export type GuildDataReset = (transaction: DatabaseTransaction) => Promise<void>;

export class GuildConfigRepository {
  constructor(private readonly db: Database) {}

  async ensureGuild(guildId: string): Promise<void> {
    await this.db.insert(guildSettings).values({ guildId }).onConflictDoUpdate({ target: guildSettings.guildId, set: { active: true, updatedAt: new Date() } });
  }
  async setup(guildId: string) {
    const [result] = await this.db.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1);
    return result;
  }
  async setBotAdminRoles(guildId: string, roleIds: readonly string[], actorId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction.insert(guildSettings).values({ guildId }).onConflictDoUpdate({ target: guildSettings.guildId, set: { active: true, updatedAt: new Date() } });
      const [current] = await transaction.select({ botAdminRoleIds: guildSettings.botAdminRoleIds }).from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1).for("update");
      if (!current) throw new Error("Failed to load bot administrator roles for update.");
      const next = [...new Set(roleIds)];
      await transaction.update(guildSettings).set({ botAdminRoleIds: next, updatedAt: new Date() }).where(eq(guildSettings.guildId, guildId));
      await insertAudit(transaction, guildId, "core", { actorId, key: "botAdminRoleIds", before: current.botAdminRoleIds, after: next });
    });
  }
  async setSetup(guildId: string, status: "unconfigured" | "configuring" | "configured", actorId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction.insert(guildSettings).values({ guildId }).onConflictDoNothing();
      const [current] = await transaction.select().from(guildSettings).where(eq(guildSettings.guildId, guildId)).limit(1).for("update");
      if (!current) throw new Error("Failed to load guild setup for update.");
      await transaction.update(guildSettings).set({ active: true, setupStatus: status, updatedAt: new Date(), ...(status === "configured" ? { setupCompletedAt: new Date(), setupCompletedBy: actorId } : { setupCompletedAt: null, setupCompletedBy: null }) }).where(eq(guildSettings.guildId, guildId));
      await insertAudit(transaction, guildId, "core", { actorId, key: "setup.status", before: current.setupStatus, after: status });
    });
  }
  async markInactive(guildId: string): Promise<void> {
    await this.db.update(guildSettings).set({ active: false, updatedAt: new Date() }).where(eq(guildSettings.guildId, guildId));
  }
  async resetGuild(guildId: string, resetModuleData: GuildDataReset): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await resetModuleData(transaction);
      await transaction.delete(configurationAuditEvents).where(eq(configurationAuditEvents.guildId, guildId));
      await transaction.delete(guildFeatures).where(eq(guildFeatures.guildId, guildId));
      await transaction.delete(guildModules).where(eq(guildModules.guildId, guildId));
      await transaction.delete(guildSettings).where(eq(guildSettings.guildId, guildId));
    });
  }
  async module(guildId: string, moduleId: string): Promise<ModuleRow | undefined> {
    const [result] = await this.db.select().from(guildModules).where(and(eq(guildModules.guildId, guildId), eq(guildModules.moduleId, moduleId))).limit(1);
    return result;
  }
  async feature(guildId: string, moduleId: string, featureId: string): Promise<FeatureRow | undefined> {
    const [result] = await this.db.select().from(guildFeatures).where(and(eq(guildFeatures.guildId, guildId), eq(guildFeatures.moduleId, moduleId), eq(guildFeatures.featureId, featureId))).limit(1);
    return result;
  }
  async saveModule(guildId: string, moduleId: string, enabled: boolean, defaultValues: Record<string, unknown>, actorId: string, fallbackBefore: boolean): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction.insert(guildModules).values({ guildId, moduleId, enabled: fallbackBefore, config: defaultValues }).onConflictDoNothing();
      const [current] = await transaction.select({ enabled: guildModules.enabled }).from(guildModules).where(and(eq(guildModules.guildId, guildId), eq(guildModules.moduleId, moduleId))).limit(1).for("update");
      if (!current) throw new Error("Failed to load module state for update.");
      if (current.enabled === enabled) return;
      await transaction.update(guildModules).set({ enabled, updatedAt: new Date() }).where(and(eq(guildModules.guildId, guildId), eq(guildModules.moduleId, moduleId)));
      await insertAudit(transaction, guildId, moduleId, { actorId, key: "module.enabled", before: current.enabled, after: enabled });
    });
  }
  async saveModuleSelection(guildId: string, changes: readonly ModuleSelectionChange[], actorId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      for (const change of changes) {
        await transaction.insert(guildModules).values({ guildId, moduleId: change.moduleId, enabled: change.fallbackBefore, config: change.defaultConfig }).onConflictDoNothing();
        const [current] = await transaction.select({ enabled: guildModules.enabled }).from(guildModules).where(and(eq(guildModules.guildId, guildId), eq(guildModules.moduleId, change.moduleId))).limit(1).for("update");
        if (!current) throw new Error("Failed to load module state for update.");
        if (current.enabled === change.enabled) continue;
        await transaction.update(guildModules).set({ enabled: change.enabled, updatedAt: new Date() }).where(and(eq(guildModules.guildId, guildId), eq(guildModules.moduleId, change.moduleId)));
        await insertAudit(transaction, guildId, change.moduleId, { actorId, key: "module.enabled", before: current.enabled, after: change.enabled });
      }
    });
  }
  async saveConfigValue(guildId: string, moduleId: string, enabled: boolean, defaults: Record<string, unknown>, change: ConfigValueChange): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction.insert(guildModules).values({ guildId, moduleId, enabled, config: defaults }).onConflictDoNothing();
      const [current] = await transaction.select().from(guildModules).where(and(eq(guildModules.guildId, guildId), eq(guildModules.moduleId, moduleId))).limit(1).for("update");
      if (!current) throw new Error("Failed to load module configuration for update.");
      const before = current.config[change.key] ?? change.fallbackBefore;
      await transaction.update(guildModules).set({ config: { ...current.config, [change.key]: change.value }, updatedAt: new Date() }).where(and(eq(guildModules.guildId, guildId), eq(guildModules.moduleId, moduleId)));
      await insertAudit(transaction, guildId, moduleId, {
        actorId: change.actorId,
        key: change.key,
        before: change.isSensitive ? "[REDACTED]" : before,
        after: change.isSensitive ? "[REDACTED]" : change.value,
      });
    });
  }
  async saveFeatureSelection(guildId: string, moduleId: string, changes: readonly FeatureSelectionChange[], actorId: string): Promise<void> {
    await this.db.transaction(async (transaction) => {
      for (const change of changes) {
        await transaction.insert(guildFeatures).values({ guildId, moduleId, featureId: change.featureId, enabled: change.fallbackBefore, config: {} }).onConflictDoNothing();
        const [current] = await transaction.select({ enabled: guildFeatures.enabled }).from(guildFeatures).where(and(eq(guildFeatures.guildId, guildId), eq(guildFeatures.moduleId, moduleId), eq(guildFeatures.featureId, change.featureId))).limit(1).for("update");
        if (!current) throw new Error("Failed to load feature state for update.");
        if (current.enabled === change.enabled) continue;
        await transaction.update(guildFeatures).set({ enabled: change.enabled, updatedAt: new Date() }).where(and(eq(guildFeatures.guildId, guildId), eq(guildFeatures.moduleId, moduleId), eq(guildFeatures.featureId, change.featureId)));
        await insertAudit(transaction, guildId, moduleId, { actorId, key: "feature.enabled", featureId: change.featureId, before: current.enabled, after: change.enabled });
      }
    });
  }
  async recentAudit(guildId: string, limit = 10) {
    return this.db.select().from(configurationAuditEvents).where(eq(configurationAuditEvents.guildId, guildId)).orderBy(desc(configurationAuditEvents.createdAt)).limit(limit);
  }
  async clearModule(guildId: string, moduleId: string, audit: ConfigChangeAudit): Promise<void> {
    await this.db.transaction(async (transaction) => {
      await transaction.delete(guildFeatures).where(and(eq(guildFeatures.guildId, guildId), eq(guildFeatures.moduleId, moduleId)));
      await transaction.delete(guildModules).where(and(eq(guildModules.guildId, guildId), eq(guildModules.moduleId, moduleId)));
      await insertAudit(transaction, guildId, moduleId, audit);
    });
  }
}

async function insertAudit(transaction: DatabaseTransaction, guildId: string, moduleId: string, audit: ConfigChangeAudit): Promise<void> {
  await transaction.insert(configurationAuditEvents).values({ guildId, moduleId, actorId: audit.actorId, key: audit.key, before: audit.before, after: audit.after, ...(audit.featureId ? { featureId: audit.featureId } : {}) });
}

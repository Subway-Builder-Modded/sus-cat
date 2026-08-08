import { and, desc, eq } from "drizzle-orm";

import type { Database } from "../database/client.js";
import { configurationAuditEvents, guildFeatures, guildModules, guildSettings } from "../database/schema.js";

export interface ModuleRow { readonly enabled: boolean; readonly config: Record<string, unknown>; }
export interface FeatureRow { readonly enabled: boolean; readonly config: Record<string, unknown>; }

export class GuildConfigRepository {
  constructor(private readonly db: Database) {}

  async ensureGuild(guildId: string): Promise<void> {
    await this.db.insert(guildSettings).values({ guildId }).onConflictDoUpdate({ target: guildSettings.guildId, set: { active: true, updatedAt: new Date() } });
  }
  async setup(guildId: string) {
    return this.db.query.guildSettings.findFirst({ where: eq(guildSettings.guildId, guildId) });
  }
  async setSetup(guildId: string, status: "unconfigured" | "configuring" | "configured", actorId: string): Promise<void> {
    await this.ensureGuild(guildId);
    await this.db.update(guildSettings).set({ setupStatus: status, updatedAt: new Date(), ...(status === "configured" ? { setupCompletedAt: new Date(), setupCompletedBy: actorId } : { setupCompletedAt: null, setupCompletedBy: null }) }).where(eq(guildSettings.guildId, guildId));
  }
  async markInactive(guildId: string): Promise<void> {
    await this.db.update(guildSettings).set({ active: false, updatedAt: new Date() }).where(eq(guildSettings.guildId, guildId));
  }
  async module(guildId: string, moduleId: string): Promise<ModuleRow | undefined> {
    return this.db.query.guildModules.findFirst({ where: and(eq(guildModules.guildId, guildId), eq(guildModules.moduleId, moduleId)) });
  }
  async feature(guildId: string, moduleId: string, featureId: string): Promise<FeatureRow | undefined> {
    return this.db.query.guildFeatures.findFirst({ where: and(eq(guildFeatures.guildId, guildId), eq(guildFeatures.moduleId, moduleId), eq(guildFeatures.featureId, featureId)) });
  }
  async saveModule(guildId: string, moduleId: string, enabled: boolean, config: Record<string, unknown>): Promise<void> {
    await this.db.insert(guildModules).values({ guildId, moduleId, enabled, config }).onConflictDoUpdate({ target: [guildModules.guildId, guildModules.moduleId], set: { enabled, config, updatedAt: new Date() } });
  }
  async saveFeature(guildId: string, moduleId: string, featureId: string, enabled: boolean, config: Record<string, unknown> = {}): Promise<void> {
    await this.db.insert(guildFeatures).values({ guildId, moduleId, featureId, enabled, config }).onConflictDoUpdate({ target: [guildFeatures.guildId, guildFeatures.moduleId, guildFeatures.featureId], set: { enabled, config, updatedAt: new Date() } });
  }
  async audit(guildId: string, actorId: string, moduleId: string, key: string, before: unknown, after: unknown, featureId?: string): Promise<void> {
    await this.db.insert(configurationAuditEvents).values({ guildId, actorId, moduleId, key, before, after, ...(featureId ? { featureId } : {}) });
  }
  async recentAudit(guildId: string, limit = 10) {
    return this.db.query.configurationAuditEvents.findMany({ where: eq(configurationAuditEvents.guildId, guildId), orderBy: [desc(configurationAuditEvents.createdAt)], limit });
  }
  async clearModule(guildId: string, moduleId: string): Promise<void> {
    await this.db.delete(guildFeatures).where(and(eq(guildFeatures.guildId, guildId), eq(guildFeatures.moduleId, moduleId)));
    await this.db.delete(guildModules).where(and(eq(guildModules.guildId, guildId), eq(guildModules.moduleId, moduleId)));
  }
  async clearGuildConfiguration(guildId: string): Promise<void> {
    await this.db.delete(guildFeatures).where(eq(guildFeatures.guildId, guildId));
    await this.db.delete(guildModules).where(eq(guildModules.guildId, guildId));
  }
}

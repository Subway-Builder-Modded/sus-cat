import { eq } from "drizzle-orm";

import type { Database } from "../../database/client.js";
import { moderationAuditEvents, moderationConfigs, type ModerationConfig } from "../../database/schema.js";

export class ConfigRepository {
  constructor(private readonly db: Database) {}

  async get(guildId: string): Promise<ModerationConfig> {
    const existing = await this.db.query.moderationConfigs.findFirst({ where: eq(moderationConfigs.guildId, guildId) });
    if (existing) return existing;
    const [created] = await this.db.insert(moderationConfigs).values({ guildId }).onConflictDoNothing().returning();
    if (created) return created;
    const concurrent = await this.db.query.moderationConfigs.findFirst({ where: eq(moderationConfigs.guildId, guildId) });
    if (!concurrent) throw new Error("Failed to initialize moderation configuration");
    return concurrent;
  }

  async update(guildId: string, actorId: string, changes: Partial<Pick<ModerationConfig, "modLogChannelId" | "auditLogChannelId" | "dmUsers" | "rulesUrl" | "purgeConfirmationThreshold" | "staffRoleIds" | "notesEnabled" | "temporaryBansEnabled" | "caseButtonsEnabled">>): Promise<ModerationConfig> {
    const before = await this.get(guildId);
    const [updated] = await this.db.update(moderationConfigs).set({ ...changes, updatedAt: new Date() }).where(eq(moderationConfigs.guildId, guildId)).returning();
    if (!updated) throw new Error("Failed to update moderation configuration");
    await this.db.insert(moderationAuditEvents).values({ eventType: "config.changed", guildId, actorId, before, after: changes });
    return updated;
  }
}

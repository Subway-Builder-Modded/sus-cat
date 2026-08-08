import type { ModerationConfig } from "../database/schema.js";
import type { GuildConfigService } from "../../../core/config/service.js";

const configurableKeys = ["modLogChannelId", "auditLogChannelId", "dmUsers", "rulesUrl", "purgeConfirmationThreshold", "staffRoleIds"] as const;

/** Module-local typed view over the generic guild configuration store. */
export class ModerationSettings {
  constructor(private readonly settings: GuildConfigService) {}

  async get(guildId: string): Promise<ModerationConfig> {
    const config = await this.settings.getModuleConfig(guildId, "moderation");
    return {
      guildId,
      modLogChannelId: stringOrNull(config.modLogChannelId),
      auditLogChannelId: stringOrNull(config.auditLogChannelId),
      dmUsers: config.dmUsers === true,
      rulesUrl: stringOrNull(config.rulesUrl),
      purgeConfirmationThreshold: typeof config.purgeConfirmationThreshold === "number" ? config.purgeConfirmationThreshold : 25,
      staffRoleIds: stringArray(config.staffRoleIds),
      reasonPresets: stringArray(config.reasonPresets),
      notesEnabled: await this.settings.isFeatureEnabled(guildId, "moderation", "notes"),
      temporaryBansEnabled: await this.settings.isFeatureEnabled(guildId, "moderation", "temporary-bans"),
      caseButtonsEnabled: await this.settings.isFeatureEnabled(guildId, "moderation", "case-buttons"),
      updatedAt: new Date(),
    };
  }

  async update(guildId: string, actorId: string, changes: Partial<Pick<ModerationConfig, "modLogChannelId" | "auditLogChannelId" | "dmUsers" | "rulesUrl" | "purgeConfirmationThreshold" | "staffRoleIds" | "notesEnabled" | "temporaryBansEnabled" | "caseButtonsEnabled">>): Promise<ModerationConfig> {
    for (const key of configurableKeys) if (key in changes) await this.settings.setConfig(guildId, "moderation", key, changes[key], actorId);
    if (changes.notesEnabled !== undefined) await this.settings.setFeatureEnabled(guildId, "moderation", "notes", changes.notesEnabled, actorId);
    if (changes.temporaryBansEnabled !== undefined) await this.settings.setFeatureEnabled(guildId, "moderation", "temporary-bans", changes.temporaryBansEnabled, actorId);
    if (changes.caseButtonsEnabled !== undefined) await this.settings.setFeatureEnabled(guildId, "moderation", "case-buttons", changes.caseButtonsEnabled, actorId);
    return this.get(guildId);
  }
}

function stringOrNull(value: unknown): string | null { return typeof value === "string" && value ? value : null; }
function stringArray(value: unknown): string[] { return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : []; }

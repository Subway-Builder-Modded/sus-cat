import type { GuildConfigService } from "../../../core/config/service.js";
import type { ModerationConfig } from "../database/schema.js";

/** Typed module-local view over the generic per-guild configuration store. */
export class ModerationSettings {
  constructor(private readonly settings: GuildConfigService) {}

  async get(guildId: string): Promise<ModerationConfig> {
    const config = await this.settings.getModuleConfig(guildId, "moderation");
    return {
      guildId,
      auditLogChannelId: stringOrNull(config.auditLogChannelId),
      caseCategoryId: stringOrNull(config.caseCategoryId),
      moderatorRoleIds: stringArray(config.moderatorRoleIds),
      rulesUrl: stringOrNull(config.rulesUrl),
      purgeConfirmationThreshold: integer(config.purgeConfirmationThreshold, 25),
      purgeScanLimit: integer(config.purgeScanLimit, 1000),
      auditScope: config.auditScope === "full" ? "full" : "moderation",
    };
  }

  feature(guildId: string, featureId: string): Promise<boolean> {
    return this.settings.isFeatureEnabled(guildId, "moderation", featureId);
  }
}

function stringOrNull(value: unknown): string | null { return typeof value === "string" && value ? value : null; }
function stringArray(value: unknown): string[] { return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : []; }
function integer(value: unknown, fallback: number): number { return typeof value === "number" && Number.isInteger(value) ? value : fallback; }

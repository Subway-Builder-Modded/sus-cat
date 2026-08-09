import { logger } from "../../../core/shared/logger.js";
import { toError } from "../../../core/shared/to-error.js";
import type { AuditEventInput, AuditRepository } from "../repositories/audit-repository.js";
import type { ModerationSettings } from "../config/settings.js";

export async function recordAuditIfEnabled(settings: ModerationSettings, repository: AuditRepository, input: AuditEventInput): Promise<void> {
  try {
    if (!await settings.feature(input.guildId, "audit-log")) return;
    await repository.record(input);
  } catch (error: unknown) {
    logger.warn("Moderation audit event could not be persisted", {
      guildId: input.guildId,
      eventType: input.eventType,
      sourceEventId: input.sourceEventId ?? null,
      error: toError(error).message,
    });
  }
}

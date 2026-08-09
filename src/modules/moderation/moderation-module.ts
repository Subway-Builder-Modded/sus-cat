import type { Database } from "../../core/database/client.js";
import type { GuildConfigService } from "../../core/config/service.js";
import { CaseRepository } from "./repositories/case-repository.js";
import { ModerationSettings } from "./config/settings.js";
import { LockRepository } from "./repositories/lock-repository.js";
import { ChannelModerationService } from "./services/channel-moderation-service.js";
import { ModerationService } from "./services/moderation-service.js";
import { ConfirmationStore } from "./interactions/confirmation-store.js";
import { CustomCaseTypeRepository } from "./repositories/custom-case-type-repository.js";
import { EvidenceRepository } from "./repositories/evidence-repository.js";
import { ActionReceiptRepository } from "./repositories/action-receipt-repository.js";
import { AuditRepository } from "./repositories/audit-repository.js";
import { DiscordActionDelivery } from "./ui/actions/discord-action-delivery.js";
import { CaseChannelService } from "./services/case-channel-service.js";
import { PurgeService } from "./services/purge-service.js";

export interface ModerationModule {
  readonly cases: CaseRepository;
  readonly caseTypes: CustomCaseTypeRepository;
  readonly evidence: EvidenceRepository;
  readonly audits: AuditRepository;
  readonly configs: ModerationSettings;
  readonly moderation: ModerationService;
  readonly channels: ChannelModerationService;
  readonly caseChannels: CaseChannelService;
  readonly purges: PurgeService;
  readonly confirmations: ConfirmationStore;
  close(): void;
}

export function createModerationModule(database: Database, settings: GuildConfigService): ModerationModule {
  const cases = new CaseRepository(database);
  const configs = new ModerationSettings(settings);
  const locks = new LockRepository(database);
  const receipts = new ActionReceiptRepository(database);
  const audits = new AuditRepository(database);
  const delivery = new DiscordActionDelivery();
  return {
    cases,
    caseTypes: new CustomCaseTypeRepository(database),
    evidence: new EvidenceRepository(database),
    audits,
    configs,
    moderation: new ModerationService(cases, receipts, audits, configs, delivery),
    channels: new ChannelModerationService(configs, locks, receipts, audits, delivery),
    caseChannels: new CaseChannelService(cases, receipts, audits, configs, settings, delivery),
    purges: new PurgeService(configs, receipts, audits, delivery),
    confirmations: new ConfirmationStore(),
    close: () => undefined,
  };
}

export function requireModerationModule(client: import("../../core/bot/bot-client.js").BotClient): ModerationModule {
  return client.requireModuleService("moderation", isModerationModule);
}

function isModerationModule(value: unknown): value is ModerationModule {
  if (typeof value !== "object" || value === null) return false;
  return "cases" in value
    && "caseTypes" in value
    && "evidence" in value
    && "audits" in value
    && "configs" in value
    && "moderation" in value
    && "channels" in value
    && "caseChannels" in value
    && "purges" in value
    && "confirmations" in value
    && "close" in value;
}
